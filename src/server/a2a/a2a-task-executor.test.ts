/**
 * Tests for createA2ATaskExecutor — the bridge between the A2A HTTP server
 * and the headless runAgentRun execution loop.
 *
 * TDD: write tests first, then implement.
 */

import { describe, it, expect, jest } from "@jest/globals";

import { createA2ATaskExecutor } from "./a2a-task-executor.js";
import {
  isTextPart,
  Role,
  TaskState,
} from "../../subsystems/channels/peer-protocol.js";
import type { A2ATask } from "../../subsystems/channels/peer-protocol.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTask(textContent: string): A2ATask {
  return {
    id: "task-test-001",
    contextId: "ctx-test-001",
    status: { state: TaskState.SUBMITTED },
    history: [
      {
        messageId: "msg-user-001",
        role: Role.USER,
        parts: [{ text: textContent }],
        taskId: "task-test-001",
        contextId: "ctx-test-001",
      },
    ],
    artifacts: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("createA2ATaskExecutor", () => {
  it("returns a function (the executor)", () => {
    const executor = createA2ATaskExecutor({ quiet: true });
    expect(typeof executor).toBe("function");
  });

  it("calls emitStatus with WORKING then COMPLETED on success", async () => {
    const fakeResult = "Agents dream of electric tasks.";

    const executor = createA2ATaskExecutor({
      quiet: true,
      // Inject a fake invokeHandler so no real LLM call is made
      _runAgentRun: jest.fn(async (_prompt: string, _options: unknown) => ({
        success: true,
        response: fakeResult,
      })),
    });

    const task = makeTask("Write a haiku about agents.");
    const statusCalls: [TaskState, string | undefined][] = [];

    await executor(task, (state, message) => {
      const part = message?.parts?.[0];
      statusCalls.push([
        state,
        part && isTextPart(part) ? part.text : undefined,
      ]);
    });

    expect(statusCalls.length).toBeGreaterThanOrEqual(2);
    expect(statusCalls[0][0]).toBe(TaskState.WORKING);
    const completedCall = statusCalls.find(([s]) => s === TaskState.COMPLETED);
    expect(completedCall).toBeDefined();
    expect(completedCall![1]).toBe(fakeResult);
  });

  it("emits FAILED when the agent run returns an error", async () => {
    const executor = createA2ATaskExecutor({
      quiet: true,
      _runAgentRun: jest.fn(async () => ({
        success: false,
        error: "Provider API key missing",
      })),
    });

    const task = makeTask("This will fail.");
    const statusCalls: [TaskState, string | undefined][] = [];

    await executor(task, (state, message) => {
      const part = message?.parts?.[0];
      statusCalls.push([
        state,
        part && isTextPart(part) ? part.text : undefined,
      ]);
    });

    const failedCall = statusCalls.find(([s]) => s === TaskState.FAILED);
    expect(failedCall).toBeDefined();
    expect(failedCall![1]).toMatch(/Provider API key missing/);
  });

  it("emits FAILED when the agent run throws", async () => {
    const executor = createA2ATaskExecutor({
      quiet: true,
      _runAgentRun: jest.fn(async () => {
        throw new Error("Network timeout");
      }),
    });

    const task = makeTask("This will throw.");
    const statusCalls: [TaskState, string | undefined][] = [];

    await executor(task, (state, message) => {
      const part = message?.parts?.[0];
      statusCalls.push([
        state,
        part && isTextPart(part) ? part.text : undefined,
      ]);
    });

    const failedCall = statusCalls.find(([s]) => s === TaskState.FAILED);
    expect(failedCall).toBeDefined();
    expect(failedCall![1]).toMatch(/Network timeout/);
  });

  it("extracts the prompt from the last USER message in task history", async () => {
    let capturedPrompt = "";
    const executor = createA2ATaskExecutor({
      quiet: true,
      _runAgentRun: jest.fn(async (prompt: string) => {
        capturedPrompt = prompt;
        return { success: true, response: "ok" };
      }),
    });

    const task = makeTask("Tell me about the A2A protocol.");
    await executor(task, () => {});

    expect(capturedPrompt).toBe("Tell me about the A2A protocol.");
  });

  it("handles a task with no history (falls back to empty prompt gracefully)", async () => {
    const executor = createA2ATaskExecutor({
      quiet: true,
      _runAgentRun: jest.fn(async () => ({ success: true, response: "ok" })),
    });

    const task: A2ATask = {
      id: "task-no-history",
      contextId: "ctx-no-history",
      status: { state: TaskState.SUBMITTED },
      history: [],
      artifacts: [],
    };

    const statusCalls: TaskState[] = [];
    await executor(task, (state) => statusCalls.push(state));

    // Should still complete (or fail gracefully), never throw
    expect(statusCalls.length).toBeGreaterThan(0);
  });
});
