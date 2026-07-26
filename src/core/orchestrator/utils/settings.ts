import { CONFIG_KEYS, getModelMaxTokens } from "../../../config/config.js";
import { setConfig as _defaultSetConfig } from "../../../db/setConfig.js";
import { syncProxyConfigToServiceWorker } from "./syncProxyConfigToServiceWorker.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { OrchestratorState } from "../orchestrator-state.js";

type SetConfigFn = (
  db: ShadowClawDatabase,
  key: string,
  value: string,
) => Promise<void>;

// ── Boolean / string / number settings ──────────────────────────────────────

export async function setContextCompressionEnabled(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  enabled: boolean,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.contextCompressionEnabled = !!enabled;

  await _setConfig(
    db,
    CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED,
    state.contextCompressionEnabled ? "true" : "false",
  );
}

export async function setGitProxyUrl(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  url: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.gitProxyUrl = url || "/git-proxy";

  await _setConfig(db, CONFIG_KEYS.GIT_PROXY_URL, state.gitProxyUrl);
}

export async function setMaxIterations(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  value: number,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.maxIterations = value;

  await _setConfig(db, CONFIG_KEYS.MAX_ITERATIONS, String(value));
}

export async function setMaxTokens(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  value: number,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const dynamicMaxTokens = getModelMaxTokens(state.model);
  const normalized = Math.max(1, Math.min(value, dynamicMaxTokens));

  state.maxTokens = normalized;

  await _setConfig(db, CONFIG_KEYS.MAX_TOKENS, String(normalized));
}

export async function setProxyUrl(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  url: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.proxyUrl = url || "/proxy";

  await _setConfig(db, CONFIG_KEYS.PROXY_URL, state.proxyUrl);
  syncProxyConfigToServiceWorker(state);
}

export async function setRateLimitAutoAdapt(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  enabled: boolean,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.rateLimitAutoAdapt = !!enabled;

  await _setConfig(
    db,
    CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT,
    state.rateLimitAutoAdapt ? "true" : "false",
  );
}

export async function setRateLimitCallsPerMinute(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  value: number,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const normalized = Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;

  state.rateLimitCallsPerMinute = normalized;

  await _setConfig(
    db,
    CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE,
    String(normalized),
  );
}

export async function setReasoningEffort(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  effort: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const normalized =
    typeof effort === "string" ? effort.trim().toLowerCase() : "none";
  state.reasoningEffort = normalized || "none";

  await _setConfig(db, CONFIG_KEYS.REASONING_EFFORT, state.reasoningEffort);
}

export async function setStreamingEnabled(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  enabled: boolean,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.streamingEnabled = !!enabled;

  await _setConfig(
    db,
    CONFIG_KEYS.STREAMING_ENABLED,
    state.streamingEnabled ? "true" : "false",
  );
}

export async function setTaskServerUrl(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  url: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.taskServerUrl = url || "/schedule";

  await _setConfig(db, CONFIG_KEYS.TASK_SERVER_URL, state.taskServerUrl);
}

export async function setUseProxy(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  enabled: boolean,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.useProxy = !!enabled;

  await _setConfig(
    db,
    CONFIG_KEYS.USE_PROXY,
    state.useProxy ? "true" : "false",
  );
  syncProxyConfigToServiceWorker(state);
}

export async function setVMBashFullInternetAccess(
  state: OrchestratorState,
  db: ShadowClawDatabase,
  enabled: boolean,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  state.vmBashFullInternetAccess = !!enabled;

  await _setConfig(
    db,
    CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS,
    state.vmBashFullInternetAccess ? "true" : "false",
  );
}

export async function setVMBashTimeout(
  _state: OrchestratorState,
  db: ShadowClawDatabase,
  timeoutSec: number,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const normalized = Math.min(Math.max(Math.floor(timeoutSec), 1), 1800);

  await _setConfig(db, CONFIG_KEYS.VM_BASH_TIMEOUT_SEC, String(normalized));
}
