/**
 * A2A Task Executor — bridges the A2A HTTP server's `SendMessage` handler
 * to ShadowClaw's headless `runAgentRun` execution loop.
 *
 * The executor is created once at server startup (sharing provider config and
 * bootstrap options) and passed to `A2AHttpServer` as the `taskExecutor`
 * option. Each inbound `SendMessage` call invokes the executor with the newly
 * created task.
 *
 * Design:
 * - Extracts the user prompt from the last ROLE_USER message in task.history
 * - Emits WORKING immediately so SSE subscribers see progress
 * - Runs `runAgentRun` (or the injected `_runAgentRun` for testing)
 * - Emits COMPLETED with the agent's text response, or FAILED on any error
 *
 * References:
 * - A2A v1.0 Specification §3.2 SendMessage / §4.1 Task lifecycle
 * - ADR: docs/decisions/server-a2a-http-binding.md
 * - ADR: docs/decisions/headless-cli-agent-participant.md
 */

import { ulid } from "../../utils/ulid.js";
import {
  Role,
  TaskState,
  type A2AMessage,
  type A2ATask,
} from "../../subsystems/channels/peer-protocol.js";
import type { A2ATaskExecutor } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface A2ATaskExecutorOptions {
  /** Workspace directory (defaults to isolated fallback sandbox) */
  workspace?: string;
  /** Override LLM provider id */
  provider?: string;
  /** Override model id */
  model?: string;
  /** API key for the provider */
  apiKey?: string;
  /** Max output tokens */
  maxTokens?: number;
  /** System prompt override */
  systemPrompt?: string;
  /** Tools to pass to the agent (comma-separated names, array, or "none") */
  tools?: string | string[] | boolean;
  /** Named tool profile to apply */
  toolsProfile?: string;
  /** Suppress all console output */
  quiet?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /**
   * Internal — injectable for testing. Defaults to the real `runAgentRun`.
   * Signature mirrors runAgentRun(prompt, options).
   */
  _runAgentRun?: (
    prompt: string,
    options: Record<string, unknown>,
  ) => Promise<{ success: boolean; response?: string; error?: string }>;
}

/**
 * Create an A2ATaskExecutor that runs each inbound A2A task through
 * the headless ShadowClaw agent (`runAgentRun`).
 *
 * @example
 * ```ts
 * const executor = createA2ATaskExecutor({ workspace: config.rootPath });
 * const a2aServer = new A2AHttpServer({ agentCard, taskExecutor: executor });
 * ```
 */
export function createA2ATaskExecutor(
  options: A2ATaskExecutorOptions = {},
): A2ATaskExecutor {
  // Lazily import runAgentRun to avoid pulling the full CLI graph into
  // server startup when the executor is never used.
  const runFn =
    options._runAgentRun ??
    (async (prompt: string, runOptions: Record<string, unknown>) => {
      const { runAgentRun } = await import("../../cli/commands/agent.js");
      return runAgentRun(prompt, runOptions as any);
    });

  return async function executeA2ATask(
    task: A2ATask,
    emitStatus: (state: TaskState, message?: A2AMessage) => void,
  ): Promise<void> {
    // 1. Extract prompt from the last USER message in history
    const lastUserMsg = [...(task.history ?? [])]
      .reverse()
      .find((m) => m.role === Role.USER);

    const prompt =
      lastUserMsg?.parts
        ?.map((p) => ("text" in p ? p.text : ""))
        .join("\n")
        .trim() ?? "";

    // 2. Immediately signal WORKING so SSE subscribers see activity
    emitStatus(TaskState.WORKING);

    try {
      const result = await runFn(prompt, {
        workspace: options.workspace,
        provider: options.provider,
        model: options.model,
        apiKey: options.apiKey,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
        tools: options.tools,
        toolsProfile: options.toolsProfile,
        quiet: options.quiet ?? true,
        verbose: options.verbose ?? false,
        // Non-interactive: skip prompts, never touch stdin
        yes: true,
        isTTY: false,
        // Pass a dedicated abort controller per-task (future: wirable to CancelTask)
        abortSignal: new AbortController().signal,
      });

      if (!result.success || result.error) {
        const errorText = result.error ?? "Agent run did not succeed";
        emitStatus(TaskState.FAILED, _agentMessage(errorText, task));
        return;
      }

      const responseText = result.response ?? "(no response)";
      emitStatus(TaskState.COMPLETED, _agentMessage(responseText, task));
    } catch (err: unknown) {
      const errorText =
        err instanceof Error
          ? err.message
          : "Unknown error during task execution";
      emitStatus(TaskState.FAILED, _agentMessage(errorText, task));
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _agentMessage(text: string, task: A2ATask): A2AMessage {
  return {
    messageId: ulid(),
    role: Role.AGENT,
    parts: [{ text }],
    taskId: task.id,
    contextId: task.contextId,
  };
}
