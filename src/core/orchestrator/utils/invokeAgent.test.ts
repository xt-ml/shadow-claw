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
const mockBuildSystemPrompt = jest.fn() as any;

jest.unstable_mockModule("../../../config/config.js", () => ({
  CONFIG_KEYS: { STORAGE_HANDLE: "STORAGE_HANDLE" },
  getProvider: mockGetProvider,
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

jest.unstable_mockModule("../../../db/groups.js", () => ({
  listGroups: mockListGroups,
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
  }),
);

jest.unstable_mockModule("../../../subsystems/providers/providers.js", () => ({
  getContextLimit: mockGetContextLimit,
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
      getChannelTypeForGroup: jest.fn().mockReturnValue("web"),
      provider: "test-provider",
      model: "test-model",
      providerConfig: { supportsStreaming: true, format: "openai" },
      assistantName: "Assistant",
      contextCompressionEnabled: false,
      maxTokens: 1000,
      maxIterations: 5,
      getApiKeyForRequest: (jest.fn() as any).mockResolvedValue("key"),
      getApiKeyForSpecificProvider: (jest.fn() as any).mockResolvedValue("key"),
      getProviderRuntimeHeaders: jest.fn().mockReturnValue({}),
      getReasoningConfig: jest.fn().mockReturnValue({}),
      rateLimitAutoAdapt: false,
      rateLimitCallsPerMinute: 60,
      streamingEnabled: true,
      createProviderRequestId: jest.fn().mockReturnValue("req-123"),
      agentWorker: { postMessage: jest.fn() },
      promptControllers: new Map(),
      compactContext: jest.fn(),
      deliverResponse: jest.fn(),
      handleWorkerMessage: jest.fn(),
      startTransformersProgressPolling: jest.fn(),
    };

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
    expect(mockOrchestrator.compactContext).toHaveBeenCalledWith(
      mockDb,
      "group1",
    );
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

    expect(mockOrchestrator.deliverResponse).not.toHaveBeenCalled();
  });

  it("should handle transformers_js_browser error", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "transformers_js_browser" },
    ]);
    mockInvokeWithTransformersJs.mockRejectedValue(
      new Error("Transformers error"),
    );

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.deliverResponse).toHaveBeenCalledWith(
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

    expect(mockOrchestrator.deliverResponse).toHaveBeenCalledWith(
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

    expect(mockOrchestrator.deliverResponse).toHaveBeenCalledWith(
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

  it("should start transformers local polling", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "transformers_js_local" },
    ]);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(
      mockOrchestrator.startTransformersProgressPolling,
    ).toHaveBeenCalledWith("group1");
    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalled();
  });
});
