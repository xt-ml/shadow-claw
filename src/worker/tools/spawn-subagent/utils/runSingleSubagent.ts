import { ulid } from "../../../../utils/ulid.js";

import {
  registerSubagentCollector,
  unregisterSubagentCollector,
} from "../../../post.js";

import type { ToolDefinition } from "../../../../subsystems/tools/types.js";
import type { InvokePayload } from "../../../../subsystems/worker/types.js";
import type { SubagentInvokeContext, SubagentSpec } from "../spawn-subagent.js";

/**
 * Run a single subagent and return its final response text.
 * The subagent's messages are collected locally and never forwarded
 * to the main thread.
 */
export async function runSingleSubagent(
  spec: SubagentSpec,
  ctx: SubagentInvokeContext,
): Promise<string> {
  const subagentGroupId = `subagent:${ulid()}`;
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
    apiKey: ctx.apiKey,
    model: spec.model ?? ctx.model,
    maxTokens: ctx.maxTokens,
    provider: ctx.provider,
    providerHeaders: ctx.providerHeaders,
    streaming: false, // subagents always run non-streaming for clean result capture
    enabledTools: subagentTools,
    isScheduledTask: false,
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
