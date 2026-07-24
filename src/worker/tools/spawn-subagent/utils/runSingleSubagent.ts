import { ulid } from "../../../../utils/ulid.js";

import {
  CONFIG_KEYS,
  getModelMaxTokens,
  getProvider,
  getProviderApiKeyConfigKey,
} from "../../../../config/config.js";

import { getConfig } from "../../../../db/getConfig.js";
import { decryptValue } from "../../../../security/crypto.js";

import {
  registerSubagentCollector,
  unregisterSubagentCollector,
} from "../../../utils/post.js";

import type { ToolDefinition } from "../../../../subsystems/tools/types.js";
import type { InvokePayload } from "../../../../subsystems/worker/types.js";
import type {
  SubagentInvokeContext,
  SubagentSpec,
  SubagentWorkspaceMode,
} from "../spawn-subagent.js";

async function resolveProviderRuntimeHeaders(
  db: any,
  providerId: string,
  providerRuntimeOverrides?: {
    bedrock_proxy?: {
      authMode?: "provider_chain" | "sso";
      profile?: string;
      region?: string;
    };
    llamafile?: {
      host?: string;
      mode?: "cli" | "server";
      offline?: boolean;
      port?: number;
    };
  },
): Promise<Record<string, string>> {
  if (providerId === "llamafile") {
    const override = providerRuntimeOverrides?.llamafile;
    const mode =
      override?.mode ||
      ((await getConfig(db, CONFIG_KEYS.LLAMAFILE_MODE)) as string) ||
      "cli";
    const host =
      override?.host ||
      ((await getConfig(db, CONFIG_KEYS.LLAMAFILE_HOST)) as string) ||
      "127.0.0.1";
    const rawPort =
      typeof override?.port === "number"
        ? override.port
        : await getConfig(db, CONFIG_KEYS.LLAMAFILE_PORT);
    const port = Number(rawPort);
    const rawOffline =
      typeof override?.offline === "boolean"
        ? override.offline
        : await getConfig(db, CONFIG_KEYS.LLAMAFILE_OFFLINE);
    const offline =
      typeof rawOffline === "boolean"
        ? rawOffline
        : String(rawOffline || "true") === "true";

    return {
      "x-llamafile-host": host,
      "x-llamafile-mode": mode === "server" ? "server" : "cli",
      "x-llamafile-offline": offline ? "true" : "false",
      "x-llamafile-port": String(
        Number.isFinite(port) && port > 0 ? port : 8080,
      ),
    };
  }

  if (providerId === "bedrock_proxy") {
    const override = providerRuntimeOverrides?.bedrock_proxy;
    const region =
      override?.region ||
      ((await getConfig(db, CONFIG_KEYS.BEDROCK_REGION_FALLBACK)) as string) ||
      "";
    const profile =
      override?.profile ||
      ((await getConfig(db, CONFIG_KEYS.BEDROCK_PROFILE_FALLBACK)) as string) ||
      "";
    const authMode =
      override?.authMode ||
      ((await getConfig(db, CONFIG_KEYS.BEDROCK_AUTH_MODE)) as string) ||
      "provider_chain";

    const headers: Record<string, string> = {
      "x-bedrock-auth-mode": authMode,
    };
    if (region) {
      headers["x-bedrock-region"] = region;
    }

    if (profile) {
      headers["x-bedrock-profile"] = profile;
    }

    return headers;
  }

  if (providerId === "mesh-llm") {
    const host =
      ((await getConfig(db, CONFIG_KEYS.MESH_LLM_HOST)) as string) || "";
    if (host) {
      return { "x-mesh-llm-host": host };
    }
  }

  return {};
}

async function resolveProviderApiKey(
  db: any,
  providerId: string,
): Promise<string> {
  const provider = getProvider(providerId);
  if (!provider || provider.requiresApiKey === false) {
    return "";
  }

  let encrypted = await getConfig(db, getProviderApiKeyConfigKey(providerId));
  if (!encrypted && providerId === "openrouter") {
    encrypted = await getConfig(db, CONFIG_KEYS.API_KEY);
  }

  if (!encrypted || typeof encrypted !== "string") {
    return "";
  }

  try {
    const decrypted = await decryptValue(encrypted);

    return decrypted || "";
  } catch {
    return "";
  }
}

async function resolveSubagentProviderAuth(
  spec: SubagentSpec,
  ctx: SubagentInvokeContext,
): Promise<{
  apiKey: string;
  provider: string;
  providerHeaders: Record<string, string>;
}> {
  const requestedProvider =
    typeof spec.provider === "string" ? spec.provider.trim() : "";
  const provider = requestedProvider || ctx.provider;

  if (provider === ctx.provider) {
    return {
      apiKey: ctx.apiKey,
      provider,
      providerHeaders: ctx.providerHeaders,
    };
  }

  const [apiKey, providerHeaders] = await Promise.all([
    resolveProviderApiKey(ctx.db, provider),
    resolveProviderRuntimeHeaders(
      ctx.db,
      provider,
      ctx.providerRuntimeOverrides,
    ),
  ]);

  return {
    apiKey,
    provider,
    providerHeaders,
  };
}

function resolveWorkspaceGroupId(
  spec: SubagentSpec,
  parentGroupId: string,
  workspaceMode: SubagentWorkspaceMode,
  isolatedGroupId: string,
): string {
  if (workspaceMode === "parent") {
    return parentGroupId;
  }

  if (workspaceMode === "isolated") {
    return isolatedGroupId;
  }

  const requestedWorkspaceGroupId =
    typeof spec.workspace_group_id === "string"
      ? spec.workspace_group_id.trim()
      : "";

  if (!requestedWorkspaceGroupId) {
    return isolatedGroupId;
  }

  if (requestedWorkspaceGroupId.toLowerCase() === "parent") {
    return parentGroupId;
  }

  return requestedWorkspaceGroupId;
}

export interface RunSingleSubagentOptions {
  parentGroupId: string;
  workspaceMode: SubagentWorkspaceMode;
}

/**
 * Run a single subagent and return its final response text.
 * The subagent's messages are collected locally and never forwarded
 * to the main thread.
 */
export async function runSingleSubagent(
  spec: SubagentSpec,
  ctx: SubagentInvokeContext,
  options: RunSingleSubagentOptions,
): Promise<string> {
  const subagentGroupId = `subagent:${ulid()}`;
  const workspaceGroupId = resolveWorkspaceGroupId(
    spec,
    options.parentGroupId,
    options.workspaceMode,
    subagentGroupId,
  );
  const providerAuth = await resolveSubagentProviderAuth(spec, ctx);
  const resolvedModel = spec.model ?? ctx.model;
  const configuredMaxTokens =
    typeof ctx.subagentMaxTokens === "number" &&
    Number.isFinite(ctx.subagentMaxTokens) &&
    ctx.subagentMaxTokens > 0
      ? Math.floor(ctx.subagentMaxTokens)
      : Math.floor(ctx.maxTokens);
  const modelMaxTokens = getModelMaxTokens(resolvedModel || "");
  const subagentMaxTokens =
    Number.isFinite(modelMaxTokens) && modelMaxTokens > 0
      ? Math.max(1, Math.min(configuredMaxTokens, Math.floor(modelMaxTokens)))
      : Math.max(1, configuredMaxTokens);
  const collector: any[] = [];

  // Filter tools: use spec.tools if provided, otherwise inherit from parent
  // but always remove spawn_subagent to prevent recursion.
  let subagentTools: ToolDefinition[];
  if (Array.isArray(spec.tools) && spec.tools.length > 0) {
    const allowedSet = new Set(spec.tools);
    subagentTools = ctx.enabledTools.filter(
      (t) => allowedSet.has(t.name) && t.name !== "spawn_subagent",
    );
  } else {
    subagentTools = ctx.enabledTools.filter((t) => t.name !== "spawn_subagent");
  }

  const payload: InvokePayload & { isScheduledTask?: boolean } = {
    groupId: subagentGroupId,
    messages: [{ role: "user", content: spec.prompt }],
    systemPrompt: spec.system_prompt ?? ctx.systemPrompt,
    assistantName: ctx.assistantName,
    memory: ctx.memory,
    apiKey: providerAuth.apiKey,
    model: resolvedModel,
    provider: providerAuth.provider,
    maxTokens: subagentMaxTokens,
    providerHeaders: providerAuth.providerHeaders,
    storageHandle: ctx.storageHandle,
    streaming: false, // subagents always run non-streaming for clean result capture
    enabledTools: subagentTools,
    isScheduledTask: false,
    workspaceGroupId,
  };

  registerSubagentCollector(subagentGroupId, collector);

  try {
    await ctx.invokeSubagent(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    return `Subagent error: ${msg}`;
  } finally {
    unregisterSubagentCollector(subagentGroupId);
  }

  // Extract the final response from the collected messages
  const responseMsg = collector.find((m) => m.type === "response");
  if (responseMsg?.payload?.text) {
    return responseMsg.payload.text;
  }

  // Check for error messages
  const errorMsg = collector.find((m) => m.type === "error");
  if (errorMsg?.payload?.error) {
    return `Subagent error: ${errorMsg.payload.error}`;
  }

  return "(no response)";
}
