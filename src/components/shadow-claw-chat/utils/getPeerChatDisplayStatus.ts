import type { OrchestratorDisplayState } from "../../../stores/orchestrator.js";

export function getPeerChatDisplayStatus(
  remoteStatus: OrchestratorDisplayState,
  isRemoteTyping: boolean,
): OrchestratorDisplayState {
  return remoteStatus === "idle" && isRemoteTyping
    ? "responding"
    : remoteStatus;
}
