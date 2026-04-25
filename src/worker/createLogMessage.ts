import { WorkerOutbound } from "../types.js";

/**
 * Create a thinking-log message object
 */
export function createLogMessage(
  groupId: string,
  level:
    | "info"
    | "api-call"
    | "tool"
    | "error"
    | "streaming"
    | "text"
    | "tool-call"
    | "tool-result",
  label: string,
  message?: string,
): WorkerOutbound {
  return {
    type: "thinking-log",
    payload: {
      groupId,
      level,
      timestamp: Date.now(),
      label,
      message: message || "",
    },
  } as WorkerOutbound;
}
