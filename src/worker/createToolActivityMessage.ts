import { WorkerOutbound } from "../types.js";

/**
 * Create a tool-activity message object
 */
export function createToolActivityMessage(
  groupId: string,
  tool: string,
  status: string,
): WorkerOutbound {
  return {
    type: "tool-activity",
    payload: { groupId, tool, status },
  } as any;
}
