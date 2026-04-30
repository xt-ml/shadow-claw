import { ToolDefinition } from "../tools/types.js";

interface ToolState {
  enabledTools: ToolDefinition[];
  systemPromptOverride: string;
}

/**
 * Worker-side tool state cache per groupId.
 * This allows the worker to reflect tool management changes in the middle
 * of an agent invocation loop.
 */
const toolStateMap = new Map<string, ToolState>();

export function setToolState(
  groupId: string,
  enabledTools: ToolDefinition[],
  systemPromptOverride: string,
) {
  toolStateMap.set(groupId, { enabledTools, systemPromptOverride });
}

export function getToolState(groupId: string): ToolState | undefined {
  return toolStateMap.get(groupId);
}

export function clearToolState(groupId: string) {
  toolStateMap.delete(groupId);
}
