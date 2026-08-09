import {
  CONFIG_KEYS,
  LLAMAFILE_PROXY_URL,
  PROVIDERS,
  buildTriggerPattern,
  getModelMaxTokens,
  getProvider,
} from "../../../../config/config.js";

import type { ProviderConfig } from "../../../../config/config.js";
import { setConfig as _defaultSetConfig } from "../../../../db/setConfig.js";
import { toolsStore } from "../../../../stores/tools.js";
import { modelRegistry } from "../../../../subsystems/providers/model-registry.js";

import type { ShadowClawDatabase } from "../../../../db/db.js";
import type { LLMProvider } from "../../../../subsystems/providers/types.js";
import type { ModelDownloadProgressPayload } from "../../../../subsystems/worker/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";
import type { EventBus } from "../EventBus.js";

type SetConfigFn = (
  db: ShadowClawDatabase,
  key: string,
  value: string,
) => Promise<void>;

export async function getApiKeyForHeaders(orchestrator: {
  getApiKey: () => Promise<string | null>;
}): Promise<string | undefined> {
  return (await orchestrator.getApiKey()) || undefined;
}

export async function getApiKeyForRequest(orchestrator: {
  getApiKey: () => Promise<string | null>;
}): Promise<string> {
  return (await orchestrator.getApiKey()) || "";
}

export function getLlamafileSettings(
  state: Pick<
    OrchestratorState,
    "llamafileMode" | "llamafileHost" | "llamafilePort" | "llamafileOffline"
  >,
): {
  host: string;
  mode: "server" | "cli";
  offline: boolean;
  port: number;
} {
  return {
    mode: state.llamafileMode,
    host: state.llamafileHost,
    port: state.llamafilePort,
    offline: state.llamafileOffline,
  };
}

export function getMeshLlmSettings(
  state: Pick<OrchestratorState, "meshLlmHost">,
): { host: string } {
  return {
    host: state.meshLlmHost,
  };
}

export function getBedrockSettings(
  state: Pick<
    OrchestratorState,
    "bedrockAuthMode" | "bedrockProfileFallback" | "bedrockRegionFallback"
  >,
): {
  authMode: string;
  profile: string;
  region: string;
} {
  return {
    authMode: state.bedrockAuthMode,
    profile: state.bedrockProfileFallback,
    region: state.bedrockRegionFallback,
  };
}

export function getAvailableProviders(): LLMProvider[] {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    ...(!config.modelsUrl && {
      models:
        Array.isArray(config.models) && config.models.length > 0
          ? config.models
          : [config.defaultModel],
    }),
    ...(config.modelsUrl && { modelsUrl: config.modelsUrl }),
    ...(config.headers && { headers: config.headers }),
    ...(config.apiKeyHeader && { apiKeyHeader: config.apiKeyHeader }),
    ...(config.apiKeyHeaderFormat && {
      apiKeyHeaderFormat: config.apiKeyHeaderFormat,
    }),
    ...(typeof config.requiresApiKey === "boolean" && {
      requiresApiKey: config.requiresApiKey,
    }),
  }));
}

export function getReasoningConfig(
  state: Pick<OrchestratorState, "reasoningEffort">,
): { effort: string } | undefined {
  const effort =
    typeof state.reasoningEffort === "string"
      ? state.reasoningEffort.trim().toLowerCase()
      : "none";
  if (!effort || effort === "none") {
    return undefined;
  }

  return { effort };
}

export function getProviderRuntimeHeaders(
  state: Pick<
    OrchestratorState,
    | "bedrockAuthMode"
    | "bedrockProfileFallback"
    | "bedrockRegionFallback"
    | "llamafileHost"
    | "llamafileMode"
    | "llamafileOffline"
    | "llamafilePort"
  >,
  providerId: string,
  requestId = "",
  overrides?: {
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
): Record<string, string> {
  if (providerId === "llamafile") {
    const llama = overrides?.llamafile;
    const headers: Record<string, string> = {
      "x-llamafile-mode":
        llama?.mode === "server" || llama?.mode === "cli"
          ? llama.mode
          : state.llamafileMode,
      "x-llamafile-host": llama?.host || state.llamafileHost,
      "x-llamafile-port": String(llama?.port || state.llamafilePort),
      "x-llamafile-offline":
        (llama?.offline ?? state.llamafileOffline) ? "true" : "false",
    };

    if (requestId) {
      headers["x-shadowclaw-request-id"] = requestId;
    }

    return headers;
  }

  if (providerId === "bedrock_proxy") {
    const bedrock = overrides?.bedrock_proxy;
    const headers: Record<string, string> = {};
    if (bedrock?.region || state.bedrockRegionFallback) {
      headers["x-bedrock-region"] =
        bedrock?.region || state.bedrockRegionFallback;
    }

    if (bedrock?.profile || state.bedrockProfileFallback) {
      headers["x-bedrock-profile"] =
        bedrock?.profile || state.bedrockProfileFallback;
    }

    headers["x-bedrock-auth-mode"] = bedrock?.authMode || state.bedrockAuthMode;

    return headers;
  }

  return {};
}

export function applyLlamafileHeaders(
  state: Pick<
    OrchestratorState,
    | "providerConfig"
    | "llamafileMode"
    | "llamafileHost"
    | "llamafilePort"
    | "llamafileOffline"
  >,
): void {
  if (state.providerConfig?.id !== "llamafile") {
    return;
  }

  state.providerConfig = {
    ...state.providerConfig,
    headers: {
      ...(state.providerConfig.headers || {}),
      "x-llamafile-mode": state.llamafileMode,
      "x-llamafile-host": state.llamafileHost,
      "x-llamafile-port": String(state.llamafilePort),
      "x-llamafile-offline": state.llamafileOffline ? "true" : "false",
    },
  };
}

export function applyMeshLlmHeaders(
  state: Pick<OrchestratorState, "providerConfig" | "meshLlmHost">,
): void {
  if (state.providerConfig?.id !== "mesh-llm") {
    return;
  }

  state.providerConfig = {
    ...state.providerConfig,
    headers: {
      ...(state.providerConfig.headers || {}),
      "x-mesh-llm-host": state.meshLlmHost,
    },
  };
}

export function getTransformersStatusUrl(
  state: Pick<
    OrchestratorState,
    "providerConfig" | "inFlightEffectiveProviderByGroup"
  > & {
    inFlightEffectiveProviderByGroup?: Map<
      string,
      { providerId: string; providerConfig: ProviderConfig }
    >;
  },
  groupId?: string,
): string {
  // If we have a groupId, check if there is an in-flight effective provider config for it
  if (groupId && state.inFlightEffectiveProviderByGroup) {
    const info = state.inFlightEffectiveProviderByGroup.get(groupId);
    if (info?.providerId === "transformers_js_local") {
      const base = info.providerConfig.baseUrl || "";
      if (base.includes("/chat/completions")) {
        return base.replace("/chat/completions", "/status");
      }
    }
  }

  // If the current providerConfig is transformers_js_local (or undefined for mock tests), use its baseUrl
  const providerConfig = state.providerConfig;
  if (
    providerConfig &&
    (!providerConfig.id || providerConfig.id === "transformers_js_local")
  ) {
    const base = providerConfig.baseUrl || "";
    if (base.includes("/chat/completions")) {
      return base.replace("/chat/completions", "/status");
    }
  }

  // Fallback to local transformers.js proxy status
  const localProvider = getProvider("transformers_js_local");
  const base = localProvider?.baseUrl || "";
  if (base.includes("/chat/completions")) {
    return base.replace("/chat/completions", "/status");
  }

  return "http://localhost:8888/transformers-js-proxy/status";
}

// ── Async setters ───────────────────────────────────────────────────────────

export async function setAssistantName(
  state: Pick<OrchestratorState, "assistantName" | "triggerPattern">,
  db: ShadowClawDatabase,
  name: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.assistantName = name;
  state.triggerPattern = buildTriggerPattern(name);

  await _setConfig(db, CONFIG_KEYS.ASSISTANT_NAME, name);
}

export async function setBedrockSettings(
  state: Pick<
    OrchestratorState,
    "bedrockAuthMode" | "bedrockProfileFallback" | "bedrockRegionFallback"
  >,
  db: ShadowClawDatabase,
  settings: { authMode: string; profile: string; region: string },
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const region =
    typeof settings.region === "string" ? settings.region.trim() : "";
  const profile =
    typeof settings.profile === "string" ? settings.profile.trim() : "";
  const authMode = settings.authMode === "sso" ? "sso" : "provider_chain";

  state.bedrockRegionFallback = region;
  state.bedrockProfileFallback = profile;
  state.bedrockAuthMode = authMode;

  await _setConfig(db, CONFIG_KEYS.BEDROCK_REGION_FALLBACK, region);
  await _setConfig(db, CONFIG_KEYS.BEDROCK_PROFILE_FALLBACK, profile);
  await _setConfig(db, CONFIG_KEYS.BEDROCK_AUTH_MODE, authMode);
}

export async function setLlamafileSettings(
  state: Pick<
    OrchestratorState,
    | "llamafileHost"
    | "llamafileMode"
    | "llamafileOffline"
    | "llamafilePort"
    | "providerConfig"
  >,
  db: ShadowClawDatabase,
  settings: {
    host: string;
    mode: "server" | "cli";
    offline: boolean;
    port: number;
  },
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.llamafileMode = settings.mode;
  state.llamafileHost = settings.host;
  state.llamafilePort = settings.port;
  state.llamafileOffline = settings.offline;

  await _setConfig(db, CONFIG_KEYS.LLAMAFILE_MODE, settings.mode);
  await _setConfig(db, CONFIG_KEYS.LLAMAFILE_HOST, settings.host);
  await _setConfig(db, CONFIG_KEYS.LLAMAFILE_PORT, String(settings.port));
  await _setConfig(
    db,
    CONFIG_KEYS.LLAMAFILE_OFFLINE,
    settings.offline ? "true" : "false",
  );

  applyLlamafileHeaders(state);
}

export async function setMeshLlmSettings(
  state: Pick<OrchestratorState, "meshLlmHost" | "providerConfig">,
  db: ShadowClawDatabase,
  settings: { host: string },
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.meshLlmHost = settings.host;

  await _setConfig(db, CONFIG_KEYS.MESH_LLM_HOST, settings.host);

  applyMeshLlmHeaders(state);
}

export async function setModel(
  state: Pick<OrchestratorState, "model" | "maxTokens" | "provider">,
  db: ShadowClawDatabase,
  model: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.model = model;
  state.maxTokens = getModelMaxTokens(state.model);

  await _setConfig(db, CONFIG_KEYS.MODEL, model);

  await autoActivateProfile(state, db);
}

export async function setPeerjsMyAlias(
  state: Pick<OrchestratorState, "peerjsMyAlias">,
  db: ShadowClawDatabase,
  alias: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.peerjsMyAlias = alias.trim();

  await _setConfig(db, CONFIG_KEYS.PEERJS_MY_ALIAS, state.peerjsMyAlias);
}

export async function setPeerjsPeerAliases(
  state: Pick<OrchestratorState, "peerjsPeerAliases">,
  db: ShadowClawDatabase,
  aliases: Record<string, string>,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.peerjsPeerAliases = { ...aliases };

  await _setConfig(
    db,
    CONFIG_KEYS.PEERJS_PEER_ALIASES,
    JSON.stringify(state.peerjsPeerAliases),
  );
}

export async function autoActivateProfile(
  state: Pick<OrchestratorState, "provider" | "model">,
  db: ShadowClawDatabase,
): Promise<void> {
  // Preserve an explicit manual "no tools" configuration.
  if (!toolsStore.activeProfileId && toolsStore.enabledToolNames.size === 0) {
    return;
  }

  const candidates = toolsStore.findProfilesForProvider(
    state.provider,
    state.model,
  );

  if (candidates.length === 0) {
    return;
  }

  const exact = candidates.find(
    (p) => p.providerId === state.provider && p.model === state.model,
  );

  if (exact) {
    await toolsStore.activateProfile(db, exact.id);

    return;
  }

  const providerOnly = candidates.find(
    (p) => p.providerId === state.provider && !p.model,
  );

  if (providerOnly) {
    await toolsStore.activateProfile(db, providerOnly.id);
  }
}

/**
 * Switch the active LLM provider. This is more complex than the simple
 * settings because it also fetches model info and auto-activates profiles.
 */
export async function setProvider(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  providerId: string,
  deps: {
    loadApiKeyForProvider: (
      db: ShadowClawDatabase,
      providerId: string,
    ) => Promise<void>;
    getApiKeyForHeaders: () => Promise<string | undefined>;
  },
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const newProvider = getProvider(providerId);
  if (!newProvider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  state.provider = providerId;
  state.providerConfig = newProvider;
  state.model = newProvider.defaultModel;
  applyLlamafileHeaders(state);
  applyMeshLlmHeaders(state);

  await deps.loadApiKeyForProvider(db, providerId);

  await modelRegistry.fetchModelInfo(
    newProvider,
    (await deps.getApiKeyForHeaders()) || undefined,
    getProviderRuntimeHeaders(state, providerId),
  );

  state.maxTokens = getModelMaxTokens(state.model);

  await _setConfig(db, CONFIG_KEYS.PROVIDER, providerId);
  await _setConfig(db, CONFIG_KEYS.MODEL, state.model);

  await autoActivateProfile(state, db);
}

export async function pollTransformersProgress(
  state: Pick<
    OrchestratorState,
    "providerConfig" | "inFlightEffectiveProviderByGroup"
  > & {
    inFlightEffectiveProviderByGroup?: Map<
      string,
      { providerId: string; providerConfig: ProviderConfig }
    >;
  },
  events: EventBus,
  groupId: string,
  stopPolling: (groupId: string) => void,
): Promise<void> {
  try {
    const url = getTransformersStatusUrl(state, groupId);
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      method: "GET",
    });

    if (!res.ok) {
      return;
    }

    const status = await res.json();
    const raw = Number(status?.progress);
    const normalizedProgress =
      Number.isFinite(raw) && raw > 1
        ? Math.max(0, Math.min(1, raw / 100))
        : Number.isFinite(raw)
          ? Math.max(0, Math.min(1, raw))
          : null;

    const payload: ModelDownloadProgressPayload = {
      groupId,
      message:
        typeof status?.message === "string" && status.message
          ? status.message
          : undefined,
      progress: normalizedProgress,
      status:
        status?.status === "done" || status?.status === "error"
          ? status.status
          : "running",
    };

    events.emit("model-download-progress", payload);

    if (payload.status === "done" || payload.status === "error") {
      stopPolling(groupId);
    }
  } catch {
    // Ignore status polling failures so inference can continue uninterrupted.
  }
}

export function startTransformersProgressPolling(
  state: Pick<
    OrchestratorState,
    "providerConfig" | "inFlightEffectiveProviderByGroup"
  > & {
    transformersProgressPollers: Map<string, number>;
    inFlightEffectiveProviderByGroup?: Map<
      string,
      { providerId: string; providerConfig: ProviderConfig }
    >;
  },
  events: EventBus,
  groupId: string,
): void {
  stopTransformersProgressPolling(state, groupId);

  // Show immediate feedback while the first network poll is in flight.
  events.emit("model-download-progress", {
    groupId,
    message: "Preparing local model download...",
    progress: null,
    status: "running",
  });

  void pollTransformersProgress(state, events, groupId, (gid) =>
    stopTransformersProgressPolling(state, gid),
  );

  const timer = setInterval(() => {
    void pollTransformersProgress(state, events, groupId, (gid) =>
      stopTransformersProgressPolling(state, gid),
    );
  }, 1000);

  state.transformersProgressPollers.set(groupId, timer as unknown as number);
}

export function stopTransformersProgressPolling(
  state: { transformersProgressPollers: Map<string, number> },
  groupId: string,
): void {
  const timer = state.transformersProgressPollers.get(groupId);
  if (typeof timer === "number") {
    clearInterval(timer);

    state.transformersProgressPollers.delete(groupId);
  }
}

export async function cancelLlamafileRequest(requestId: string): Promise<void> {
  try {
    await fetch(LLAMAFILE_PROXY_URL.replace("/chat/completions", "/cancel"), {
      body: JSON.stringify({ requestId }),
      headers: {
        "Content-Type": "application/json",
        "x-shadowclaw-request-id": requestId,
      },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // Best-effort cancellation only.
  }
}
