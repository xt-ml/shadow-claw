// @ts-nocheck
import { jest } from "@jest/globals";

describe("executeSpawnSubagentTool", () => {
  let executeSpawnSubagentTool: any;
  let mockHandleInvoke: any;
  let mockUlid: any;
  let mockRegisterSubagentCollector: any;
  let mockUnregisterSubagentCollector: any;

  beforeEach(async () => {
    jest.resetModules();

    mockHandleInvoke = jest.fn();
    mockUlid = jest.fn(() => "test-ulid-0001");
    mockRegisterSubagentCollector = jest.fn();
    mockUnregisterSubagentCollector = jest.fn();

    jest.unstable_mockModule("../handleInvoke.js", () => ({
      handleInvoke: mockHandleInvoke,
    }));

    jest.unstable_mockModule("../../utils/ulid.js", () => ({
      ulid: mockUlid,
    }));

    jest.unstable_mockModule("../../db/getConfig.js", () => ({
      getConfig: jest.fn().mockResolvedValue(5),
    }));

    jest.unstable_mockModule("../../config.js", () => ({
      CONFIG_KEYS: {
        SUBAGENT_MAX_PARALLEL: "subagent_max_parallel",
      },
      DEFAULT_SUBAGENT_MAX_PARALLEL: 5,
    }));

    jest.unstable_mockModule("../post.js", () => ({
      post: jest.fn(),
      registerSubagentCollector: mockRegisterSubagentCollector,
      unregisterSubagentCollector: mockUnregisterSubagentCollector,
    }));

    const mod = await import("./spawn-subagent.js");
    executeSpawnSubagentTool = mod.executeSpawnSubagentTool;
  });

  const makeContext = (overrides = {}) => ({
    db: {} as any,
    apiKey: "test-api-key",
    model: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    maxTokens: 4096,
    providerHeaders: {},
    streaming: false,
    enabledTools: [
      { name: "read_file", description: "Read a file" },
      { name: "spawn_subagent", description: "Spawn subagent" },
    ],
    assistantName: "TestBot",
    memory: "",
    systemPrompt: "You are a helpful assistant.",
    invokeSubagent: (payload: any) => mockHandleInvoke({}, payload),
    ...overrides,
  });

  it("calls handleInvoke with a subagent groupId starting with 'subagent:'", async () => {
    mockHandleInvoke.mockImplementation((_db: any, payload: any) => {
      // Simulate the subagent posting a response message
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: "subagent result" },
        });
      }

      return Promise.resolve();
    });

    const result = await executeSpawnSubagentTool(
      { prompt: "summarize this topic" },
      "parent-group",
      makeContext(),
    );

    expect(mockHandleInvoke).toHaveBeenCalledTimes(1);
    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.groupId).toMatch(/^subagent:/);
    expect(result).toContain("subagent result");
  });

  it("uses a unique ulid for subagent groupId", async () => {
    mockUlid.mockReturnValueOnce("ulid-aaa").mockReturnValueOnce("ulid-bbb");

    mockHandleInvoke.mockImplementation((_db: any, payload: any) => {
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: "done" },
        });
      }

      return Promise.resolve();
    });

    await executeSpawnSubagentTool(
      { prompt: "task" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.groupId).toBe("subagent:ulid-aaa");
  });

  it("excludes spawn_subagent from the subagent's tool list to prevent recursion", async () => {
    mockHandleInvoke.mockImplementation((_db: any, payload: any) => {
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: "done" },
        });
      }

      return Promise.resolve();
    });

    await executeSpawnSubagentTool(
      { prompt: "task" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    const toolNames = (payload.enabledTools || []).map((t: any) => t.name);
    expect(toolNames).not.toContain("spawn_subagent");
  });

  it("uses the provided tools list when specified in input", async () => {
    mockHandleInvoke.mockImplementation((_db: any, payload: any) => {
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: "done" },
        });
      }

      return Promise.resolve();
    });

    await executeSpawnSubagentTool(
      { prompt: "task", tools: ["read_file"] },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    const toolNames = (payload.enabledTools || []).map((t: any) => t.name);
    expect(toolNames).toEqual(["read_file"]);
  });

  it("overrides model when specified in input", async () => {
    mockHandleInvoke.mockImplementation((_db: any, payload: any) => {
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: "done" },
        });
      }

      return Promise.resolve();
    });

    await executeSpawnSubagentTool(
      { prompt: "task", model: "gpt-4o" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.model).toBe("gpt-4o");
  });

  it("registers and unregisters the subagent collector", async () => {
    mockHandleInvoke.mockImplementation((_db: any, _payload: any) => {
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: "done" },
        });
      }

      return Promise.resolve();
    });

    await executeSpawnSubagentTool(
      { prompt: "task" },
      "parent-group",
      makeContext(),
    );

    expect(mockRegisterSubagentCollector).toHaveBeenCalledTimes(1);
    expect(mockUnregisterSubagentCollector).toHaveBeenCalledTimes(1);
    // The same groupId should be registered and unregistered
    const registeredId = mockRegisterSubagentCollector.mock.calls[0][0];
    const unregisteredId = mockUnregisterSubagentCollector.mock.calls[0][0];
    expect(registeredId).toBe(unregisteredId);
  });

  it("unregisters the collector even if handleInvoke throws", async () => {
    mockHandleInvoke.mockRejectedValue(new Error("subagent crashed"));

    await executeSpawnSubagentTool(
      { prompt: "task" },
      "parent-group",
      makeContext(),
    );

    expect(mockUnregisterSubagentCollector).toHaveBeenCalledTimes(1);
  });

  it("returns an error string if handleInvoke throws (does not rethrow)", async () => {
    mockHandleInvoke.mockRejectedValue(new Error("LLM API failure"));

    const result = await executeSpawnSubagentTool(
      { prompt: "task" },
      "parent-group",
      makeContext(),
    );

    expect(typeof result).toBe("string");
    expect(result).toContain("error");
  });

  it("returns '(no response)' when subagent produces no response message", async () => {
    mockHandleInvoke.mockResolvedValue(undefined); // no response pushed to collector

    const result = await executeSpawnSubagentTool(
      { prompt: "task" },
      "parent-group",
      makeContext(),
    );

    expect(result).toContain("(no response)");
  });

  it("runs parallel_agents in parallel and combines results", async () => {
    let callCount = 0;
    mockHandleInvoke.mockImplementation((_db: any, _payload: any) => {
      callCount++;
      const n = callCount;
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: `result ${n}` },
        });
      }

      return Promise.resolve();
    });

    mockUlid
      .mockReturnValueOnce("uid-1")
      .mockReturnValueOnce("uid-2")
      .mockReturnValueOnce("uid-3");

    const result = await executeSpawnSubagentTool(
      {
        prompt: "orchestrate",
        parallel_agents: [
          { prompt: "task A" },
          { prompt: "task B" },
          { prompt: "task C" },
        ],
      },
      "parent-group",
      makeContext(),
    );

    expect(mockHandleInvoke).toHaveBeenCalledTimes(3);
    expect(result).toContain("result 1");
    expect(result).toContain("result 2");
    expect(result).toContain("result 3");
  });

  it("overrides system_prompt when specified", async () => {
    mockHandleInvoke.mockImplementation((_db: any, payload: any) => {
      const collectors = mockRegisterSubagentCollector.mock.calls;
      const lastCall = collectors[collectors.length - 1];
      if (lastCall) {
        const [collectedGroupId, collectorArr] = lastCall;
        collectorArr.push({
          type: "response",
          payload: { groupId: collectedGroupId, text: "done" },
        });
      }

      return Promise.resolve();
    });

    await executeSpawnSubagentTool(
      { prompt: "task", system_prompt: "You are a research bot." },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.systemPrompt).toBe("You are a research bot.");
  });

  it("enforces max parallel subagents limit", async () => {
    // The mock is set to 5 by default
    const result = await executeSpawnSubagentTool(
      {
        prompt: "orchestrate",
        parallel_agents: [
          { prompt: "task 1" },
          { prompt: "task 2" },
          { prompt: "task 3" },
          { prompt: "task 4" },
          { prompt: "task 5" },
          { prompt: "task 6" },
        ],
      },
      "parent-group",
      makeContext(),
    );

    expect(mockHandleInvoke).not.toHaveBeenCalled();
    expect(result).toContain(
      "Error: Requested 6 parallel subagents, but the maximum allowed is 5.",
    );
  });
});
