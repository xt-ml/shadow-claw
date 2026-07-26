import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../../../../config/config.js";
import { setConfig as _defaultSetConfig } from "../../../../db/setConfig.js";

import type { ShadowClawDatabase } from "../../../../db/db.js";
import type { VMBootMode } from "../../../../shell/vm.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

type SetConfigFn = (
  db: ShadowClawDatabase,
  key: string,
  value: string,
) => Promise<void>;

export function openTerminalSession(
  state: Pick<OrchestratorState, "agentWorker">,
  groupId = DEFAULT_GROUP_ID,
): void {
  state.agentWorker?.postMessage({
    payload: { groupId },
    type: "vm-terminal-open",
  });
}

export function closeTerminalSession(
  state: Pick<OrchestratorState, "agentWorker">,
  groupId = DEFAULT_GROUP_ID,
): void {
  state.agentWorker?.postMessage({
    payload: { groupId },
    type: "vm-terminal-close",
  });
}

export function sendTerminalInput(
  state: Pick<OrchestratorState, "agentWorker">,
  data: string,
): void {
  state.agentWorker?.postMessage({
    payload: { data },
    type: "vm-terminal-input",
  });
}

export function syncTerminalWorkspace(
  state: Pick<OrchestratorState, "agentWorker">,
  groupId = DEFAULT_GROUP_ID,
): void {
  state.agentWorker?.postMessage({
    payload: { groupId },
    type: "vm-workspace-sync",
  });
}

export function flushTerminalWorkspace(
  state: Pick<OrchestratorState, "agentWorker">,
  groupId = DEFAULT_GROUP_ID,
): void {
  state.agentWorker?.postMessage({
    payload: { groupId },
    type: "vm-workspace-flush",
  });
}

export function answerUserPrompt(
  state: Pick<OrchestratorState, "agentWorker">,
  id: string,
  response: string | null,
): void {
  state.agentWorker?.postMessage({
    payload: { id, response },
    type: "ask-user-response",
  });
}

export async function setVMBootMode(
  state: Pick<OrchestratorState, "vmBootMode" | "agentWorker">,
  db: ShadowClawDatabase,
  mode: VMBootMode,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const normalized =
    mode === "disabled" || mode === "9p" || mode === "ext2" || mode === "auto"
      ? mode
      : "disabled";
  state.vmBootMode = normalized;
  await _setConfig(db, CONFIG_KEYS.VM_BOOT_MODE, normalized);
  state.agentWorker?.postMessage({
    payload: { mode: normalized },
    type: "set-vm-mode",
  });
}

export async function setVMBootHost(
  state: Pick<OrchestratorState, "agentWorker">,
  db: ShadowClawDatabase,
  bootHost: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const normalized = typeof bootHost === "string" ? bootHost.trim() : "";
  await _setConfig(db, CONFIG_KEYS.VM_BOOT_HOST, normalized);
  state.agentWorker?.postMessage({
    payload: { bootHost: normalized },
    type: "set-vm-mode",
  });
}

export async function setVMNetworkRelayURL(
  state: Pick<OrchestratorState, "agentWorker">,
  db: ShadowClawDatabase,
  relayUrl: string,
  _setConfig: SetConfigFn = _defaultSetConfig,
): Promise<void> {
  const normalized = typeof relayUrl === "string" ? relayUrl.trim() : "";
  await _setConfig(db, CONFIG_KEYS.VM_NETWORK_RELAY_URL, normalized);
  state.agentWorker?.postMessage({
    payload: { networkRelayUrl: normalized },
    type: "set-vm-mode",
  });
}
