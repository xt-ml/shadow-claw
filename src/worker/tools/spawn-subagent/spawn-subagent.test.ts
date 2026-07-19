// @ts-nocheck
import { jest } from "@jest/globals";

describe("executeSpawnSubagentTool", () => {
  let executeSpawnSubagentTool: any;
  let mockGetConfig: any;
  let mockDecryptValue: any;
  let mockHandleInvoke: any;
  let mockUlid: any;
  let mockRegisterSubagentCollector: any;
  let mockUnregisterSubagentCollector: any;

  beforeEach(async () => {
    jest.resetModules();

    mockHandleInvoke = jest.fn();
    mockDecryptValue = jest.fn(async (value: string) => {
      if (value === "enc-openai") {
        return "openai-key";
      }

      return "";
    });

    mockGetConfig = jest.fn(async (_db: any, key: string) => {
      if (key === "subagent_max_parallel") {
        return 5;
      }

      if (key === "subagent_workspace_mode") {
        return "automatic";
      }

      if (key === "api_key:openai") {
        return "enc-openai";
      }

      return undefined;
    });
    mockUlid = jest.fn(() => "test-ulid-0001");
    mockRegisterSubagentCollector = jest.fn();
    mockUnregisterSubagentCollector = jest.fn();

    jest.unstable_mockModule("../../../utils/ulid.js", () => ({
      ulid: mockUlid,
    }));

    jest.unstable_mockModule("../../../db/getConfig.js", () => ({
      getConfig: mockGetConfig,
    }));

    jest.unstable_mockModule("../../../config/config.js", () => ({
      CONFIG_KEYS: {
        API_KEY: "api_key",
        BEDROCK_AUTH_MODE: "bedrock_auth_mode",
        BEDROCK_PROFILE_FALLBACK: "bedrock_profile_fallback",
        BEDROCK_REGION_FALLBACK: "bedrock_region_fallback",
        LLAMAFILE_HOST: "llamafile_host",
        LLAMAFILE_MODE: "llamafile_mode",
        LLAMAFILE_OFFLINE: "llamafile_offline",
        LLAMAFILE_PORT: "llamafile_port",
        MESH_LLM_HOST: "mesh_llm_host",
        SUBAGENT_MAX_PARALLEL: "subagent_max_parallel",
        SUBAGENT_WORKSPACE_MODE: "subagent_workspace_mode",
      },
      DEFAULT_SUBAGENT_MAX_PARALLEL: 5,
      DEFAULT_SUBAGENT_WORKSPACE_MODE: "automatic",
      getModelMaxTokens: jest.fn((modelId: string) => {
        if (String(modelId).includes("haiku")) {
          return 64000;
        }

        if (String(modelId).includes("opus")) {
          return 128000;
        }

        return 8192;
      }),
      getProvider: jest.fn((providerId: string) => {
        if (providerId === "openai") {
          return { id: "openai", requiresApiKey: true };
        }

        if (providerId === "bedrock_proxy") {
          return { id: "bedrock_proxy", requiresApiKey: false };
        }

        return { id: providerId, requiresApiKey: true };
      }),
      getProviderApiKeyConfigKey: jest.fn(
        (providerId: string) => `api_key:${providerId}`,
      ),
    }));

    jest.unstable_mockModule("../../../security/crypto.js", () => ({
      decryptValue: mockDecryptValue,
    }));

    jest.unstable_mockModule("../../utils/post.js", () => ({
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
    subagentModelSelectionMode: "automatic",
    subagentPinnedProvider: undefined,
    subagentPinnedModel: undefined,
    storageHandle: undefined,
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

  it("clamps subagent max tokens by selected model limit", async () => {
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
      { prompt: "task", model: "anthropic.claude-haiku-4-5" },
      "parent-group",
      makeContext({ maxTokens: 128000 }),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.maxTokens).toBe(64000);
  });

  it("uses conversation subagent max tokens override but keeps model-safe clamp", async () => {
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
      { prompt: "task", model: "anthropic.claude-haiku-4-5" },
      "parent-group",
      makeContext({ maxTokens: 128000, subagentMaxTokens: 100000 }),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.maxTokens).toBe(64000);
  });

  it("overrides provider when specified in input", async () => {
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
      { prompt: "task", provider: "openai" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.provider).toBe("openai");
    expect(payload.apiKey).toBe("openai-key");
  });

  it("resolves bedrock provider runtime headers when provider is overridden", async () => {
    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      if (key === "subagent_max_parallel") {
        return 5;
      }

      if (key === "subagent_workspace_mode") {
        return "automatic";
      }

      if (key === "bedrock_region_fallback") {
        return "us-west-2";
      }

      if (key === "bedrock_profile_fallback") {
        return "my-profile";
      }

      if (key === "bedrock_auth_mode") {
        return "sso";
      }

      return undefined;
    });

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
      { prompt: "task", provider: "bedrock_proxy" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.providerHeaders).toEqual({
      "x-bedrock-auth-mode": "sso",
      "x-bedrock-profile": "my-profile",
      "x-bedrock-region": "us-west-2",
    });
  });

  it("forwards storageHandle from parent context", async () => {
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
      makeContext({ storageHandle: { kind: "directory-handle" } }),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.storageHandle).toEqual({ kind: "directory-handle" });
  });

  it("in automatic mode, uses parent workspace when workspace_group_id is 'parent'", async () => {
    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      if (key === "subagent_max_parallel") {
        return 5;
      }

      if (key === "subagent_workspace_mode") {
        return "automatic";
      }

      return undefined;
    });

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
      { prompt: "task", workspace_group_id: "parent" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.workspaceGroupId).toBe("parent-group");
  });

  it("manual parent mode forces parent workspace regardless of requested workspace_group_id", async () => {
    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      if (key === "subagent_max_parallel") {
        return 5;
      }

      if (key === "subagent_workspace_mode") {
        return "parent";
      }

      return undefined;
    });

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
      { prompt: "task", workspace_group_id: "custom-group" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.workspaceGroupId).toBe("parent-group");
  });

  it("manual isolated mode forces isolated workspace even when parent is requested", async () => {
    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      if (key === "subagent_max_parallel") {
        return 5;
      }

      if (key === "subagent_workspace_mode") {
        return "isolated";
      }

      return undefined;
    });

    mockUlid.mockReturnValueOnce("iso-123");
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
      { prompt: "task", workspace_group_id: "parent" },
      "parent-group",
      makeContext(),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.workspaceGroupId).toBe("subagent:iso-123");
  });

  it("uses conversation-level manual subagent provider/model defaults when tool input omits them", async () => {
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
      makeContext({
        subagentModelSelectionMode: "manual",
        subagentPinnedProvider: "openai",
        subagentPinnedModel: "gpt-4o",
      }),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.provider).toBe("openai");
    expect(payload.model).toBe("gpt-4o");
  });

  it("manual subagent defaults override per-tool provider/model inputs", async () => {
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
      { prompt: "task", provider: "anthropic", model: "claude-3-5" },
      "parent-group",
      makeContext({
        subagentModelSelectionMode: "manual",
        subagentPinnedProvider: "openai",
        subagentPinnedModel: "gpt-4o",
      }),
    );

    const [_db, payload] = mockHandleInvoke.mock.calls[0];
    expect(payload.provider).toBe("openai");
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
