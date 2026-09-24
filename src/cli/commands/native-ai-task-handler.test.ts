import { describe, expect, it, jest } from "@jest/globals";
import { handleNativeAiTaskMessage } from "./native-ai-task-handler.js";

describe("src/cli/commands/native-ai-task-handler", () => {
  it("resolves pending resolver on successful task execution", async () => {
    const mockResolve = jest.fn();
    const mockReject = jest.fn();

    (globalThis as any).pendingNativeAiResolvers = {
      task123: { resolve: mockResolve, reject: mockReject },
    };

    const mockCore = {
      executeNativeAiTask: jest.fn<(...args: any[]) => Promise<any>>(
        async () => ({
          result: "summarized text",
        }),
      ),
    };

    const payload = {
      id: "task123",
      groupId: "grp-1",
      taskType: "summarize",
      input: { text: "Hello" },
    };

    await handleNativeAiTaskMessage(mockCore, {} as any, payload);

    expect(mockCore.executeNativeAiTask).toHaveBeenCalledWith({
      taskType: "summarize",
      input: { text: "Hello" },
      groupId: "grp-1",
      db: expect.anything(),
    });

    expect(mockResolve).toHaveBeenCalledWith({ result: "summarized text" });
    expect(mockReject).not.toHaveBeenCalled();
    expect(
      (globalThis as any).pendingNativeAiResolvers.task123,
    ).toBeUndefined();
  });

  it("rejects pending resolver on task failure", async () => {
    const mockResolve = jest.fn();
    const mockReject = jest.fn();

    (globalThis as any).pendingNativeAiResolvers = {
      task456: { resolve: mockResolve, reject: mockReject },
    };

    const testError = new Error("Task failed");
    const mockCore = {
      executeNativeAiTask: jest.fn<(...args: any[]) => Promise<any>>(
        async () => {
          throw testError;
        },
      ),
    };

    const payload = {
      id: "task456",
      groupId: "grp-2",
      taskType: "translate",
      input: { text: "Bonjour" },
    };

    await handleNativeAiTaskMessage(mockCore, {} as any, payload);

    expect(mockReject).toHaveBeenCalledWith(testError);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(
      (globalThis as any).pendingNativeAiResolvers.task456,
    ).toBeUndefined();
  });

  it("does nothing if payload is missing or executeNativeAiTask is missing", async () => {
    expect(() =>
      handleNativeAiTaskMessage(null, {} as any, null),
    ).not.toThrow();
    expect(() =>
      handleNativeAiTaskMessage({}, {} as any, { id: "1" }),
    ).not.toThrow();
  });
});
