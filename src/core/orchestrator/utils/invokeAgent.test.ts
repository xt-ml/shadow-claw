import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockBuildDynamicContext = jest.fn() as any;
const mockEstimateTokens = jest.fn() as any;
const mockBuildConversationMessages = jest.fn() as any;
const mockGetConfig = jest.fn() as any;
const mockListGroups = jest.fn() as any;
const mockSaveMessage = jest.fn() as any;
const mockReadGroupFile = jest.fn() as any;

const mockInvokeWithLiteRtLm = jest.fn() as any;
const mockIsLiteRtLmSupported = jest.fn() as any;

const mockInvokeWithPromptApi = jest.fn() as any;
const mockIsPromptApiSupported = jest.fn() as any;

const mockGetContextLimit = jest.fn() as any;
const mockGetProvider = jest.fn() as any;

const mockInvokeWithTransformersJs = jest.fn() as any;
const mockUlid = jest.fn() as any;
const mockWorkerPost = jest.fn() as any;
const mockRegisterSubagentCollector = jest.fn() as any;
const mockUnregisterSubagentCollector = jest.fn() as any;
const mockBuildSystemPrompt = jest.fn() as any;

const mockGetChannelTypeForGroup = jest.fn() as any;
jest.unstable_mockModule("./operations/channel.js", () => ({
  getChannelTypeForGroup: mockGetChannelTypeForGroup,
}));

const mockGetApiKeyForRequest = jest.fn() as any;
const mockGetProviderRuntimeHeaders = jest.fn() as any;
const mockGetReasoningConfig = jest.fn() as any;
const mockStartTransformersProgressPolling = jest.fn() as any;
jest.unstable_mockModule("./operations/provider.js", () => ({
  getApiKeyForRequest: mockGetApiKeyForRequest,
  getProviderRuntimeHeaders: mockGetProviderRuntimeHeaders,
  getReasoningConfig: mockGetReasoningConfig,
  startTransformersProgressPolling: mockStartTransformersProgressPolling,
}));

const mockCompactContext = jest.fn() as any;
jest.unstable_mockModule("./compactContext.js", () => ({
  compactContext: mockCompactContext,
}));

const mockDeliverResponse = jest.fn() as any;
jest.unstable_mockModule("./deliverResponse.js", () => ({
  deliverResponse: mockDeliverResponse,
}));

const mockHandleWorkerMessage = jest.fn() as any;
jest.unstable_mockModule("./handleWorkerMessage.js", () => ({
  handleWorkerMessage: mockHandleWorkerMessage,
}));

jest.unstable_mockModule("../../../config/config.js", () => ({
  CONFIG_KEYS: { STORAGE_HANDLE: "STORAGE_HANDLE" },
  OPFS_ROOT: "shadowclaw",
  DEFAULT_GROUP_ID: "br:main",
  DEFAULT_MAX_ITERATIONS: 50,
  DEFAULT_DEV_HOST: "localhost",
  DEFAULT_DEV_PORT: 8888,
  DEFAULT_VM_NETWORK_RELAY_URL: "",
  DEFAULT_SUBAGENT_MAX_PARALLEL: 5,
  DEFAULT_SUBAGENT_WORKSPACE_MODE: "automatic",
  FETCH_MAX_RESPONSE: 50 * 1024 * 1024,
  ASSISTANT_NAME: "Assistant",
  GENERAL_ACCOUNT_PROVIDER_CAPABILITIES: [],
  getGeneralAccountProviderCapabilities: jest.fn(),
  PROVIDERS: {},
  getProvider: mockGetProvider,
  getProviderApiKeyConfigKey: jest.fn(),
  getAvailableProviders: jest.fn().mockReturnValue([]),
  getModelMaxTokens: jest.fn((modelId: string) => {
    if (String(modelId).includes("haiku-4")) {
      return 64000;
    }

    if (String(modelId).includes("sonnet-4")) {
      return 64000;
    }

    if (String(modelId).includes("opus-4-8")) {
      return 128000;
    }

    return 128000;
  }),
  buildTriggerPattern: jest.fn().mockReturnValue(new RegExp("")),
  getProviderTokenAuthScheme: jest.fn(),
  LLAMAFILE_PROXY_URL: "/proxy/llamafile",
  BASH_DEFAULT_TIMEOUT_SEC: 60,
  BASH_MAX_TIMEOUT_SEC: 300,
  OAUTH_PROVIDER_DEFINITIONS: {},
}));

jest.unstable_mockModule("../../../context/buildDynamicContext.js", () => ({
  buildDynamicContext: mockBuildDynamicContext,
}));

jest.unstable_mockModule("../../../context/estimateTokens.js", () => ({
  estimateTokens: mockEstimateTokens,
}));

jest.unstable_mockModule("../../../db/buildConversationMessages.js", () => ({
  buildConversationMessages: mockBuildConversationMessages,
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue(null),
}));

jest.unstable_mockModule("../../../db/groups.js", () => ({
  listGroups: mockListGroups,
  createGroup: jest.fn(),
  getGroupMetadata: jest.fn(),
}));

jest.unstable_mockModule("../../../db/saveMessage.js", () => ({
  saveMessage: mockSaveMessage,
}));

jest.unstable_mockModule("../../../storage/readGroupFile.js", () => ({
  readGroupFile: mockReadGroupFile,
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    getPeerState: jest.fn(),
    tokenUsage: null,
  },
}));

jest.unstable_mockModule("../../../stores/tools.js", () => ({
  toolsStore: {
    allTools: [{ name: "tool1" }],
    enabledTools: [{ name: "tool1" }],
  },
}));

jest.unstable_mockModule(
  "../../../subsystems/providers/litert-lm-provider.js",
  () => ({
    invokeWithLiteRtLm: mockInvokeWithLiteRtLm,
    isLiteRtLmSupported: mockIsLiteRtLmSupported,
  }),
);

jest.unstable_mockModule(
  "../../../subsystems/providers/prompt-api-provider.js",
  () => ({
    invokeWithPromptApi: mockInvokeWithPromptApi,
    isPromptApiSupported: mockIsPromptApiSupported,
    compactWithPromptApi: jest.fn(),
  }),
);

jest.unstable_mockModule("../../../subsystems/providers/providers.js", () => ({
  buildHeaders: jest.fn().mockReturnValue({}),
  formatRequest: jest.fn().mockReturnValue({}),
  getContextLimit: mockGetContextLimit,
  normalizeMeshLlmResult: jest.fn().mockImplementation((result) => result),
  parseResponse: jest.fn().mockImplementation((result) => result),
}));

jest.unstable_mockModule(
  "../../../subsystems/providers/transformers-js-provider.js",
  () => ({
    invokeWithTransformersJs: mockInvokeWithTransformersJs,
  }),
);

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: mockUlid,
}));

jest.unstable_mockModule("../../../worker/utils/post.js", () => ({
  post: mockWorkerPost,
  registerSubagentCollector: mockRegisterSubagentCollector,
  unregisterSubagentCollector: mockUnregisterSubagentCollector,
}));

jest.unstable_mockModule("../../../worker/utils/system-prompt.js", () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
}));

const { invokeAgent } = await import("./invokeAgent.js");

describe("invokeAgent", () => {
  let mockOrchestrator: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {};
    mockOrchestrator = {
      inFlightTriggerByGroup: new Map(),
      inFlightEffectiveProviderByGroup: new Map(),
      pendingScheduledTasks: new Set(),
      schedulerTriggeredGroups: new Set(),
      setState: jest.fn(),
      router: { setTyping: jest.fn() },
      events: { emit: jest.fn() },
      provider: "test-provider",
      model: "test-model",
      providerConfig: { supportsStreaming: true, format: "openai" },
      assistantName: "Assistant",
      contextCompressionEnabled: false,
      maxTokens: 1000,
      maxIterations: 5,
      getApiKeyForSpecificProvider: (jest.fn() as any).mockResolvedValue("key"),
      rateLimitAutoAdapt: false,
      rateLimitCallsPerMinute: 60,
      streamingEnabled: true,
      createProviderRequestId: jest.fn().mockReturnValue("req-123"),
      agentWorker: { postMessage: jest.fn() },
      promptControllers: new Map(),
    };

    mockGetChannelTypeForGroup.mockReturnValue("web");
    mockGetApiKeyForRequest.mockResolvedValue("key");
    mockGetProviderRuntimeHeaders.mockReturnValue({});
    mockGetReasoningConfig.mockReturnValue({});
    mockCompactContext.mockResolvedValue(undefined);
    mockDeliverResponse.mockResolvedValue(undefined);
    mockHandleWorkerMessage.mockResolvedValue(undefined);
    mockStartTransformersProgressPolling.mockReturnValue(undefined);

    mockGetConfig.mockResolvedValue("storage-handle");
    mockBuildSystemPrompt.mockReturnValue("system prompt");
    mockEstimateTokens.mockReturnValue(100);
    mockGetContextLimit.mockReturnValue(4000);
    mockBuildConversationMessages.mockResolvedValue([]);
    mockBuildDynamicContext.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      estimatedTokens: 50,
      usagePercent: 10,
      truncatedCount: 0,
    });
    mockListGroups.mockResolvedValue([]);
    mockReadGroupFile.mockResolvedValue("memory content");
    mockGetProvider.mockImplementation((id: string) => ({
      defaultModel: "default-" + id,
      supportsStreaming: true,
      format: "openai",
    }));
  });

  it("should initialize invocation and emit typing", async () => {
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.inFlightTriggerByGroup.get("group1")).toBe("hello");
    expect(mockOrchestrator.setState).toHaveBeenCalledWith(
      "thinking",
      "group1",
    );
    expect(mockOrchestrator.router.setTyping).toHaveBeenCalledWith(
      "group1",
      true,
    );
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("typing", {
      groupId: "group1",
      typing: true,
    });
  });

  it("should save scheduled task message", async () => {
    mockUlid.mockReturnValue("msg-id");

    await invokeAgent(
      mockOrchestrator,
      mockDb,
      "group1",
      "[SCHEDULED TASK] do it",
    );

    expect(mockOrchestrator.pendingScheduledTasks.has("group1")).toBe(true);
    expect(mockSaveMessage).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        id: "msg-id",
        sender: "Scheduler",
        isTrigger: true,
      }),
    );
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "message",
      expect.any(Object),
    );
  });

  it("should auto-compact context if usage is high", async () => {
    mockBuildConversationMessages.mockResolvedValue(new Array(15).fill({}));
    mockBuildDynamicContext.mockReturnValue({
      messages: [],
      estimatedTokens: 3500,
      usagePercent: 85,
      truncatedCount: 5,
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "show-toast",
      expect.any(Object),
    );

    // Fast-forward microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockCompactContext).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
    );
  });

  it("should blend actual token usage to prevent meter regression", async () => {
    const { orchestratorStore } =
      await import("../../../stores/orchestrator.js");

    // Set a baseline heuristic that is low (e.g. 50 + 100 = 150)
    mockBuildDynamicContext.mockReturnValue({
      messages: [],
      estimatedTokens: 50,
      usagePercent: 5,
      truncatedCount: 0,
    });

    // Mock the actual token usage from the API to be much higher (e.g. a huge cached prompt)
    (orchestratorStore as any).tokenUsage = {
      inputTokens: 100,
      cacheReadTokens: 3000,
      outputTokens: 50,
    };

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    // The emitted context usage should use the actual token footprint (100 + 3000 + 50 = 3150)
    // rather than falling back to the 150 heuristic
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "context-usage",
      expect.objectContaining({
        estimatedTokens: 3150,
      }),
    );

    // Cleanup
    (orchestratorStore as any).tokenUsage = null;
  });

  it("should handle transformers_js_browser", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "transformers_js_browser" },
    ]);
    mockInvokeWithTransformersJs.mockResolvedValue(undefined);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockInvokeWithTransformersJs).toHaveBeenCalled();
    expect(mockOrchestrator.promptControllers.has("group1")).toBe(false);
  });

  it("should handle transformers_js_browser abort", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "transformers_js_browser" },
    ]);
    const abortErr = new Error("Abort");
    abortErr.name = "AbortError";
    mockInvokeWithTransformersJs.mockRejectedValue(abortErr);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockDeliverResponse).not.toHaveBeenCalled();
  });

  it("should handle transformers_js_browser error", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "transformers_js_browser" },
    ]);
    mockInvokeWithTransformersJs.mockRejectedValue(
      new Error("Transformers error"),
    );

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("Transformers error"),
    );
  });

  it("should handle prompt_api", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "prompt_api" },
    ]);
    mockIsPromptApiSupported.mockReturnValue(true);
    mockInvokeWithPromptApi.mockResolvedValue(undefined);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockInvokeWithPromptApi).toHaveBeenCalled();
  });

  it("should handle prompt_api not supported", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "prompt_api" },
    ]);
    mockIsPromptApiSupported.mockReturnValue(false);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("Prompt API is not available"),
    );
  });

  it("should handle litert_lm_browser", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "litert_lm_browser" },
    ]);
    mockIsLiteRtLmSupported.mockReturnValue(true);
    mockInvokeWithLiteRtLm.mockResolvedValue(undefined);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockInvokeWithLiteRtLm).toHaveBeenCalled();
  });

  it("should handle litert_lm_browser not supported", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "litert_lm_browser" },
    ]);
    mockIsLiteRtLmSupported.mockReturnValue(false);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("LiteRT-LM requires WebGPU"),
    );
  });

  it("should post message to worker for other providers", async () => {
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        apiKey: "key",
        groupId: "group1",
        memory: "memory content",
        model: "test-model",
        provider: "test-provider",
      }),
    });
  });

  it("should use pinned provider and model from group", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "pinned-provider",
        pinnedModel: "pinned-model",
      },
    ]);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        provider: "pinned-provider",
        model: "pinned-model",
      }),
    });
  });

  it("should clamp max tokens to the conversation model limit", async () => {
    mockOrchestrator.maxTokens = 128000;
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "test-provider",
        pinnedModel: "anthropic.claude-haiku-4-5",
      },
    ]);
    mockGetContextLimit.mockReturnValue(64000);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invoke",
        payload: expect.objectContaining({
          model: "anthropic.claude-haiku-4-5",
          maxTokens: 64000,
        }),
      }),
    );
  });

  it("should use the conversation max tokens override before model clamp", async () => {
    mockOrchestrator.maxTokens = 64000;
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "test-provider",
        pinnedModel: "anthropic.claude-opus-4-8",
        pinnedMaxTokens: 100000,
      },
    ]);
    mockGetContextLimit.mockReturnValue(128000);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invoke",
        payload: expect.objectContaining({
          model: "anthropic.claude-opus-4-8",
          maxTokens: 100000,
        }),
      }),
    );
  });

  it("should start transformers local polling", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "transformers_js_local" },
    ]);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockStartTransformersProgressPolling).toHaveBeenCalledWith(
      mockOrchestrator,
      mockOrchestrator.events,
      "group1",
    );
    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalled();
  });

  it("should skip history when freshContext is true", async () => {
    mockBuildConversationMessages.mockResolvedValue([
      { role: "user", content: "old message 1" },
      { role: "assistant", content: "old message 2" },
      { role: "user", content: "trigger message" },
    ]);

    await invokeAgent(
      mockOrchestrator,
      mockDb,
      "group1",
      "trigger message",
      true,
    );

    expect(mockBuildDynamicContext).toHaveBeenCalledWith(
      [{ role: "user", content: "trigger message" }],
      expect.any(Object),
    );
  });

  it("should pass subagentTask true when subagent is true", async () => {
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello", false, true);

    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        subagentTask: true,
      }),
    });
  });

  it("should execute subagent task using an isolated groupId and not set parent groupId to thinking", async () => {
    mockUlid.mockReturnValue("subagent-ulid");
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello", false, true);

    // Assert that thinking state and typing indicators are set on the subagent group ID
    expect(mockOrchestrator.setState).toHaveBeenCalledWith(
      "thinking",
      "subagent:subagent-ulid",
    );
    expect(mockOrchestrator.router.setTyping).toHaveBeenCalledWith(
      "subagent:subagent-ulid",
      true,
    );

    // Assert that the parent group ID is NOT set to thinking or typing
    expect(mockOrchestrator.setState).not.toHaveBeenCalledWith(
      "thinking",
      "group1",
    );
    expect(mockOrchestrator.router.setTyping).not.toHaveBeenCalledWith(
      "group1",
      true,
    );

    // Assert that the agent worker is invoked with the subagent group ID
    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        groupId: "subagent:subagent-ulid",
        subagentTask: true,
      }),
    });
  });
});
