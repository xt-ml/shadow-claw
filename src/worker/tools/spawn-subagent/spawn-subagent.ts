import {
  CONFIG_KEYS,
  DEFAULT_SUBAGENT_MAX_PARALLEL,
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
  maxTokens: number;
  providerHeaders: Record<string, string>;
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
  model?: string;
  system_prompt?: string;
}

/**
 * Execute the spawn_subagent tool.
 *
 * Handles both single-agent (prompt) and multi-agent fan-out (parallel_agents).
 * Results from parallel subagents are combined with labeled sections.
 */
export async function executeSpawnSubagentTool(
  input: Record<string, any>,
  _groupId: string,
  ctx: SubagentInvokeContext,
): Promise<string> {
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

    const specs: SubagentSpec[] = input.parallel_agents;

    const results = await Promise.all(
      specs.map((spec, i) => {
        const fullSpec: SubagentSpec = {
          prompt: spec.prompt ?? "",
          tools: spec.tools,
          model: spec.model,
          system_prompt: spec.system_prompt,
        };

        return runSingleSubagent(fullSpec, ctx).then((text) => ({
          index: i + 1,
          prompt: spec.prompt,
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
  const spec: SubagentSpec = {
    prompt: input.prompt ?? "",
    tools: input.tools,
    model: input.model,
    system_prompt: input.system_prompt,
  };

  return runSingleSubagent(spec, ctx);
}
