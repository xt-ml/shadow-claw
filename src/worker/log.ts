import { createLogMessage } from "./createLogMessage.js";
import { post } from "./post.js";

/**
 * Log a message
 */
export function log(
  groupId: string,
  level:
    | "info"
    | "api-call"
    | "tool"
    | "error"
    | "warning"
    | "tool-call"
    | "tool-result"
    | "text",
  label: string,
  message?: string,
): void {
  post(createLogMessage(groupId, level as any, label, message));
}
