import {
  CONFIG_KEYS,
  DEFAULT_SUBAGENT_MAX_PARALLEL,
  DEFAULT_SUBAGENT_WORKSPACE_MODE,
} from "../../../config/config.js";

import { getConfig } from "../../../db/getConfig.js";
import { runSingleSubagent } from "./utils/runSingleSubagent.js";

import type { ToolDefinition } from "../../../subsystems/tools/types.js";
import type { InvokePayload } from "../../../subsystems/worker/types.js";

/**
 * Context inherited from the parent agent invocation.
 * Passed through executeTool's options so spawn_subagent can build
 * a valid InvokePayload without access to the full orchestrator state.
 */
export interface SubagentInvokeContext {
  db: any;
  apiKey: string;
  model: string;
  provider: string;
  subagentModelSelectionMode?: "automatic" | "manual";
  subagentMaxTokens?: number;
  subagentPinnedProvider?: string;
  subagentPinnedModel?: string;
  subagentFastProvider?: string;
  subagentFastModel?: string;
  subagentSmartProvider?: string;
  subagentSmartModel?: string;
  subagentPowerfulProvider?: string;
  subagentPowerfulModel?: string;
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
  };
  maxTokens: number;
  providerHeaders: Record<string, string>;
  storageHandle?: any;
  streaming: boolean;
  enabledTools: ToolDefinition[];
  assistantName: string;
  memory: string;
  systemPrompt: string;
  invokeSubagent: (
    payload: InvokePayload & { isScheduledTask?: boolean },
  ) => Promise<void>;
}

export interface SubagentSpec {
  prompt: string;
  tools?: string[];
  profile?: "current" | "fast" | "smart" | "powerful";
  model?: string;
  provider?: string;
  workspace_group_id?: string;
  system_prompt?: string;
}

export type SubagentWorkspaceMode = "automatic" | "parent" | "isolated";

function normalizeSubagentWorkspaceMode(value: unknown): SubagentWorkspaceMode {
  if (value === "parent" || value === "isolated" || value === "automatic") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "parent" ||
      normalized === "isolated" ||
      normalized === "automatic"
    ) {
      return normalized;
    }
  }

  return DEFAULT_SUBAGENT_WORKSPACE_MODE as SubagentWorkspaceMode;
}

function resolveSpec(specInput: any, ctx: SubagentInvokeContext): SubagentSpec {
  const isManual = ctx.subagentModelSelectionMode === "manual";
  let resolvedProvider: string | undefined;
  let resolvedModel: string | undefined;

  if (isManual) {
    resolvedProvider = ctx.subagentPinnedProvider;
    resolvedModel = ctx.subagentPinnedModel;
  } else {
    // Automatic mode: resolve based on profile parameter
    const profile = specInput.profile || "current";
    if (
      profile === "fast" &&
      ctx.subagentFastProvider &&
      ctx.subagentFastModel
    ) {
      resolvedProvider = ctx.subagentFastProvider;
      resolvedModel = ctx.subagentFastModel;
    } else if (
      profile === "smart" &&
      ctx.subagentSmartProvider &&
      ctx.subagentSmartModel
    ) {
      resolvedProvider = ctx.subagentSmartProvider;
      resolvedModel = ctx.subagentSmartModel;
    } else if (
      profile === "powerful" &&
      ctx.subagentPowerfulProvider &&
      ctx.subagentPowerfulModel
    ) {
      resolvedProvider = ctx.subagentPowerfulProvider;
      resolvedModel = ctx.subagentPowerfulModel;
    } else {
      // Fallback to "current" (parent)
      resolvedProvider = ctx.provider;
      resolvedModel = ctx.model;
    }
  }

  return {
    prompt: specInput.prompt ?? "",
    tools: specInput.tools,
    profile: specInput.profile,
    model: resolvedModel,
    provider: resolvedProvider,
    workspace_group_id: specInput.workspace_group_id,
    system_prompt: specInput.system_prompt,
  };
}

/**
 * Execute the spawn_subagent tool.
 *
 * Handles both single-agent (prompt) and multi-agent fan-out (parallel_agents).
 * Results from parallel subagents are combined with labeled sections.
 */
export async function executeSpawnSubagentTool(
  input: Record<string, any>,
  groupId: string,
  ctx: SubagentInvokeContext,
): Promise<string> {
  const rawWorkspaceMode = await getConfig(
    ctx.db,
    CONFIG_KEYS.SUBAGENT_WORKSPACE_MODE,
  );
  const workspaceMode = normalizeSubagentWorkspaceMode(rawWorkspaceMode);

  // Multi-agent fan-out via parallel_agents
  if (
    Array.isArray(input.parallel_agents) &&
    input.parallel_agents.length > 0
  ) {
    const rawMax = await getConfig(ctx.db, CONFIG_KEYS.SUBAGENT_MAX_PARALLEL);
    const configuredMax = Number(rawMax);
    const maxSubagents =
      Number.isFinite(configuredMax) && configuredMax > 0
        ? configuredMax
        : DEFAULT_SUBAGENT_MAX_PARALLEL;

    if (input.parallel_agents.length > maxSubagents) {
      return `Error: Requested ${input.parallel_agents.length} parallel subagents, but the maximum allowed is ${maxSubagents}. Please reduce the number of parallel agents.`;
    }

    const specs: any[] = input.parallel_agents;

    const results = await Promise.all(
      specs.map((specInput, i) => {
        const fullSpec = resolveSpec(specInput, ctx);

        return runSingleSubagent(fullSpec, ctx, {
          parentGroupId: groupId,
          workspaceMode,
        }).then((text) => ({
          index: i + 1,
          prompt: specInput.prompt ?? "",
          text,
        }));
      }),
    );

    if (results.length === 1) {
      return results[0].text;
    }

    return results
      .map(
        (r) =>
          `## Subagent ${r.index}: ${r.prompt.slice(0, 80)}${r.prompt.length > 80 ? "…" : ""}\n\n${r.text}`,
      )
      .join("\n\n---\n\n");
  }

  // Single subagent
  const spec = resolveSpec(input, ctx);

  return runSingleSubagent(spec, ctx, {
    parentGroupId: groupId,
    workspaceMode,
  });
}
