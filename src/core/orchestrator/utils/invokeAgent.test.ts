import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";
import { activate_skill } from "../../../subsystems/skills/tool.js";

const mockBuildDynamicContext = jest.fn<(...args: unknown[]) => unknown>();
const mockEstimateTokens = jest.fn<(...args: unknown[]) => number>();
const mockBuildConversationMessages =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetConfig = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockListGroups = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockSaveMessage = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockReadGroupFile = jest.fn<(...args: unknown[]) => Promise<unknown>>();

const mockInvokeWithLiteRtLm =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockIsLiteRtLmSupported = jest.fn<() => boolean>();

const mockInvokeWithPromptApi =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockIsPromptApiSupported = jest.fn<() => boolean>();
const mockEnsureBuiltinAiPolyfills = jest.fn<() => Promise<unknown>>();

const mockGetContextLimit = jest.fn<(...args: unknown[]) => number>();
const mockGetProvider = jest.fn<(...args: unknown[]) => unknown>();

const mockInvokeWithTransformersJs =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUlid = jest.fn<() => string>();
const mockWorkerPost = jest.fn<(...args: unknown[]) => unknown>();
const mockRegisterSubagentCollector =
  jest.fn<(...args: unknown[]) => unknown>();
const mockUnregisterSubagentCollector =
  jest.fn<(...args: unknown[]) => unknown>();
const mockBuildSystemPrompt = jest.fn<(...args: unknown[]) => string>();

const mockGetChannelTypeForGroup = jest.fn<(...args: unknown[]) => unknown>();
jest.unstable_mockModule("./operations/channel.js", () => ({
  getChannelTypeForGroup: mockGetChannelTypeForGroup,
}));

const mockLoadDeclarativeTools =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFindDeclarativeTool = jest.fn<(...args: unknown[]) => unknown>();
jest.unstable_mockModule("../../../subsystems/tools/declarative.js", () => ({
  loadDeclarativeTools: mockLoadDeclarativeTools,
  findDeclarativeTool: mockFindDeclarativeTool,
}));

const mockGetApiKeyForRequest =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetProviderRuntimeHeaders =
  jest.fn<(...args: unknown[]) => unknown>();
const mockGetReasoningConfig = jest.fn<(...args: unknown[]) => unknown>();
const mockStartTransformersProgressPolling =
  jest.fn<(...args: unknown[]) => unknown>();
jest.unstable_mockModule("./operations/provider.js", () => ({
  getApiKeyForRequest: mockGetApiKeyForRequest,
  getProviderRuntimeHeaders: mockGetProviderRuntimeHeaders,
  getReasoningConfig: mockGetReasoningConfig,
  startTransformersProgressPolling: mockStartTransformersProgressPolling,
}));

const mockCompactContext = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("./compactContext.js", () => ({
  compactContext: mockCompactContext,
}));

const mockDeliverResponse = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("./deliverResponse.js", () => ({
  deliverResponse: mockDeliverResponse,
}));

const mockDispatchSubagentInvoke =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("./dispatchSubagentInvoke.js", () => ({
  dispatchSubagentInvoke: mockDispatchSubagentInvoke,
}));

const mockHandleWorkerMessage =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("./handleWorkerMessage.js", () => ({
  handleWorkerMessage: mockHandleWorkerMessage,
}));

const mockDiscoverSkills = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule(
  "../../../subsystems/skills/discoverSkills.js",
  () => ({
    discoverSkills: mockDiscoverSkills,
  }),
);

jest.unstable_mockModule(
  "../../../subsystems/providers/builtin-ai-tasks.js",
  () => ({
    ensureBuiltinAiPolyfills: mockEnsureBuiltinAiPolyfills,
  }),
);

jest.unstable_mockModule("../../../config/config.js", () => ({
  CONFIG_KEYS: {
    STORAGE_HANDLE: "STORAGE_HANDLE",
    PROMPT_API_FALLBACK_MODEL: "PROMPT_API_FALLBACK_MODEL",
  },
  OPFS_ROOT: "shadowclaw",
  DEFAULT_GROUP_ID: "br:main",
  DEFAULT_MAX_ITERATIONS: 50,
  DEFAULT_DEV_HOST: "localhost",
  DEFAULT_DEV_PORT: 8888,
  DEFAULT_VM_NETWORK_RELAY_URL: "",
  DEFAULT_SUBAGENT_MAX_PARALLEL: 5,
  DEFAULT_SUBAGENT_WORKSPACE_MODE: "automatic",
  DEFAULT_PROMPT_API_FALLBACK_MODEL: "onnx-community/Qwen3-0.6B-ONNX",
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
  getDb: jest.fn<() => Promise<null>>().mockResolvedValue(null),
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

interface MockTokenUsage {
  inputTokens?: number;
  cacheReadTokens?: number;
  outputTokens?: number;
}

const mockOrchestratorStore = {
  getPeerState: jest.fn<() => Record<string, unknown> | undefined>(),
  tokenUsage: null as MockTokenUsage | null,
};

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: mockOrchestratorStore,
}));

const mockToolsStore = {
  allTools: [{ name: "tool1" }],
  enabledTools: [{ name: "tool1" }],
  systemPromptOverride: undefined as string | undefined,
  refreshDeclarativeTools: jest.fn(
    async (db: ShadowClawDatabase, groupId: string) => {
      const res = (await mockLoadDeclarativeTools(db, groupId)) as {
        tools?: Array<{ name: string }>;
      };
      return res?.tools || [];
    },
  ),
  isDeclarativeToolEnabled: jest.fn(
    (name: string) => name !== "disabled_decl_tool",
  ),
};

jest.unstable_mockModule("../../../stores/tools.js", () => ({
  toolsStore: mockToolsStore,
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
  let mockOrchestrator: Orchestrator;
  let mockDb: ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {} as unknown as ShadowClawDatabase;
    mockOrchestratorStore.tokenUsage = null;
    mockOrchestratorStore.getPeerState.mockReturnValue(undefined);

    mockToolsStore.allTools = [{ name: "tool1" }];
    mockToolsStore.enabledTools = [{ name: "tool1" }];
    mockToolsStore.systemPromptOverride = undefined;

    mockOrchestrator = {
      inFlightTriggerByGroup: new Map<string, string>(),
      inFlightEffectiveProviderByGroup: new Map<string, unknown>(),
      pendingScheduledTasks: new Set<string>(),
      schedulerTriggeredGroups: new Set<string>(),
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
      getApiKeyForSpecificProvider: jest
        .fn<() => Promise<string>>()
        .mockResolvedValue("key"),
      rateLimitAutoAdapt: false,
      rateLimitCallsPerMinute: 60,
      streamingEnabled: true,
      createProviderRequestId: jest
        .fn<() => string>()
        .mockReturnValue("req-123"),
      agentWorker: { postMessage: jest.fn() },
      promptControllers: new Map<string, AbortController>(),
    } as unknown as Orchestrator;

    mockGetChannelTypeForGroup.mockReturnValue("web");
    mockGetApiKeyForRequest.mockResolvedValue("key");
    mockGetProviderRuntimeHeaders.mockReturnValue({});
    mockGetReasoningConfig.mockReturnValue({});
    mockCompactContext.mockResolvedValue(undefined);
    mockDeliverResponse.mockResolvedValue(undefined);
    mockDispatchSubagentInvoke.mockResolvedValue(undefined);
    mockHandleWorkerMessage.mockResolvedValue(undefined);
    mockDiscoverSkills.mockResolvedValue({ skills: [] });
    mockEnsureBuiltinAiPolyfills.mockResolvedValue(undefined);
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
    mockLoadDeclarativeTools.mockResolvedValue({
      tools: [],
      diagnostics: [],
    });
    mockGetProvider.mockImplementation((id: unknown) => ({
      defaultModel: "default-" + String(id),
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
    expect(mockOrchestrator.router?.setTyping).toHaveBeenCalledWith(
      "group1",
      true,
    );
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("typing", {
      groupId: "group1",
      typing: true,
    });
  });

  it("should gracefully handle readGroupFile errors", async () => {
    mockReadGroupFile.mockRejectedValue(new Error("File not found"));

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invoke",
        payload: expect.objectContaining({
          memory: "",
        }),
      }),
    );
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

  it("should auto-compact context if usage is high and trigger compactContext", async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockCompactContext).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
    );
  });

  it("should blend actual token usage to prevent meter regression", async () => {
    mockBuildDynamicContext.mockReturnValue({
      messages: [],
      estimatedTokens: 50,
      usagePercent: 5,
      truncatedCount: 0,
    });

    mockOrchestratorStore.tokenUsage = {
      inputTokens: 100,
      cacheReadTokens: 3000,
      outputTokens: 50,
    };

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "context-usage",
      expect.objectContaining({
        estimatedTokens: 3150,
      }),
    );
  });

  it("should handle token usage zero fallbacks when fields are undefined", async () => {
    mockBuildDynamicContext.mockReturnValue({
      messages: [],
      estimatedTokens: 50,
      usagePercent: 5,
      truncatedCount: 0,
    });

    mockOrchestratorStore.tokenUsage = {};

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "context-usage",
      expect.objectContaining({
        estimatedTokens: 250,
      }),
    );
  });

  it("should pass peer state to buildSystemPrompt when available", async () => {
    mockOrchestratorStore.getPeerState.mockReturnValue({ peerId: "node-1" });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(
      "Assistant",
      "memory content",
      expect.any(Array),
      undefined,
      { peerId: "node-1" },
      [],
      { groupId: "group1" },
    );
  });

  it("should append activate_skill to activeTools when skills are discovered", async () => {
    mockDiscoverSkills.mockResolvedValue({
      skills: [{ name: "weather-skill" }],
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          enabledTools: expect.arrayContaining([
            expect.objectContaining({ name: "tool1" }),
            activate_skill,
          ]),
        }),
      }),
    );
  });

  it("should not duplicate activate_skill if already in tools", async () => {
    mockToolsStore.allTools = [{ name: activate_skill.name }];
    mockToolsStore.enabledTools = [{ name: activate_skill.name }];
    mockDiscoverSkills.mockResolvedValue({
      skills: [{ name: "weather-skill" }],
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    const call = (
      mockOrchestrator.agentWorker?.postMessage as unknown as jest.Mock
    ).mock.calls[0][0] as {
      payload: { enabledTools: Array<{ name: string }> };
    };
    const matching = call.payload.enabledTools.filter(
      (t) => t.name === activate_skill.name,
    );
    expect(matching).toHaveLength(1);
  });

  it("should handle subagentModelSelectionMode manual", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", subagentModelSelectionMode: "manual" },
    ]);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          subagentModelSelectionMode: "manual",
        }),
      }),
    );
  });

  it("should resolve prompt_api fallback model when prompt api is not supported", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "prompt_api",
        pinnedModel: "browser-built-in",
      },
    ]);
    mockIsPromptApiSupported.mockReturnValue(false);
    mockGetConfig.mockImplementation(async (...args: unknown[]) => {
      const key = args[1] as string;
      if (key === "PROMPT_API_FALLBACK_MODEL") {
        return "custom-fallback-model";
      }
      return "storage-handle";
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockGetContextLimit).toHaveBeenCalledWith("custom-fallback-model");
  });

  it("should default prompt_api fallback model when config has no fallback", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "prompt_api",
        pinnedModel: "",
      },
    ]);
    mockIsPromptApiSupported.mockReturnValue(false);
    mockGetConfig.mockImplementation(async (...args: unknown[]) => {
      const key = args[1] as string;
      if (key === "PROMPT_API_FALLBACK_MODEL") {
        return "";
      }
      return "storage-handle";
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockGetContextLimit).toHaveBeenCalledWith(
      "onnx-community/Qwen3-0.6B-ONNX",
    );
  });

  it("should handle transformers_js_browser lifecycle, subagent invocation, and worker message", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "transformers_js_browser" },
    ]);
    mockInvokeWithTransformersJs.mockImplementation(
      async (...args: unknown[]) => {
        const onMessage = args[5] as (msg: unknown) => Promise<void>;
        const ctx = args[9] as {
          invokeSubagent: (payload: unknown) => Promise<void>;
        };
        await onMessage({ type: "chunk", data: "test" });
        await ctx.invokeSubagent({ prompt: "spawn subagent" });
      },
    );

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockInvokeWithTransformersJs).toHaveBeenCalled();
    expect(mockHandleWorkerMessage).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      { type: "chunk", data: "test" },
    );
    expect(mockDispatchSubagentInvoke).toHaveBeenCalledWith(
      mockDb,
      { prompt: "spawn subagent" },
      expect.any(AbortSignal),
    );
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
    expect(mockOrchestrator.promptControllers.has("group1")).toBe(false);
  });

  it("should handle transformers_js_browser error and non-error thrown", async () => {
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

    mockInvokeWithTransformersJs.mockRejectedValue("string failure");
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("string failure"),
    );
  });

  it("should handle prompt_api lifecycle, subagent invocation, and worker message", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "prompt_api" },
    ]);
    mockIsPromptApiSupported.mockReturnValue(true);
    mockInvokeWithPromptApi.mockImplementation(async (...args: unknown[]) => {
      const onMessage = args[5] as (msg: unknown) => Promise<void>;
      const ctx = args[8] as {
        invokeSubagent: (payload: unknown) => Promise<void>;
      };
      await onMessage({ type: "prompt-chunk" });
      await ctx.invokeSubagent({ prompt: "prompt-sub" });
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockInvokeWithPromptApi).toHaveBeenCalled();
    expect(mockHandleWorkerMessage).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      { type: "prompt-chunk" },
    );
    expect(mockDispatchSubagentInvoke).toHaveBeenCalledWith(
      mockDb,
      { prompt: "prompt-sub" },
      expect.any(AbortSignal),
    );
    expect(mockOrchestrator.promptControllers.has("group1")).toBe(false);
  });

  it("should polyfill and handle prompt_api unsupported error", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "prompt_api" },
    ]);
    mockIsPromptApiSupported.mockReturnValue(false);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockEnsureBuiltinAiPolyfills).toHaveBeenCalled();
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("Prompt API is not available"),
    );
  });

  it("should handle prompt_api abort and errors", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "prompt_api" },
    ]);
    mockIsPromptApiSupported.mockReturnValue(true);

    const abortErr = new Error("Abort");
    abortErr.name = "AbortError";
    mockInvokeWithPromptApi.mockRejectedValueOnce(abortErr);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");
    expect(mockDeliverResponse).not.toHaveBeenCalled();

    mockInvokeWithPromptApi.mockRejectedValueOnce(new Error("Prompt crash"));
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("Prompt crash"),
    );

    mockInvokeWithPromptApi.mockRejectedValueOnce("prompt string error");
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("prompt string error"),
    );
  });

  it("should handle litert_lm_browser lifecycle, subagent invocation, and worker message", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "litert_lm_browser" },
    ]);
    mockIsLiteRtLmSupported.mockReturnValue(true);
    mockInvokeWithLiteRtLm.mockImplementation(async (...args: unknown[]) => {
      const onMessage = args[5] as (msg: unknown) => Promise<void>;
      const ctx = args[9] as {
        invokeSubagent: (payload: unknown) => Promise<void>;
      };
      await onMessage({ type: "litert-chunk" });
      await ctx.invokeSubagent({ prompt: "litert-sub" });
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockInvokeWithLiteRtLm).toHaveBeenCalled();
    expect(mockHandleWorkerMessage).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      { type: "litert-chunk" },
    );
    expect(mockDispatchSubagentInvoke).toHaveBeenCalledWith(
      mockDb,
      { prompt: "litert-sub" },
      expect.any(AbortSignal),
    );
    expect(mockOrchestrator.promptControllers.has("group1")).toBe(false);
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

  it("should handle litert_lm_browser abort and errors", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "litert_lm_browser" },
    ]);
    mockIsLiteRtLmSupported.mockReturnValue(true);

    const abortErr = new Error("Abort");
    abortErr.name = "AbortError";
    mockInvokeWithLiteRtLm.mockRejectedValueOnce(abortErr);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");
    expect(mockDeliverResponse).not.toHaveBeenCalled();

    mockInvokeWithLiteRtLm.mockRejectedValueOnce(new Error("LiteRT crash"));
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("LiteRT crash"),
    );

    mockInvokeWithLiteRtLm.mockRejectedValueOnce("litert string err");
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "group1",
      expect.stringContaining("litert string err"),
    );
  });

  it("should stream when provider format is anthropic and streaming is enabled", async () => {
    mockListGroups.mockResolvedValue([
      { groupId: "group1", pinnedProvider: "anthropic-provider" },
    ]);
    mockGetProvider.mockImplementation(() => ({
      defaultModel: "claude-3-haiku",
      supportsStreaming: true,
      format: "anthropic",
    }));

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          streaming: true,
        }),
      }),
    );
  });

  it("should not stream when streaming is disabled or provider does not support it", async () => {
    mockOrchestrator.streamingEnabled = false;
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          streaming: false,
        }),
      }),
    );
  });

  it("should mark isScheduledTask when group is in schedulerTriggeredGroups", async () => {
    mockOrchestrator.schedulerTriggeredGroups.add("group1");

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          isScheduledTask: true,
        }),
      }),
    );
  });

  it("should post message to worker for other providers", async () => {
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
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

  it("should record the resolved effective model in inFlightEffectiveProviderByGroup", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "pinned-provider",
        pinnedModel: "pinned-model",
      },
    ]);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(
      mockOrchestrator.inFlightEffectiveProviderByGroup.get("group1"),
    ).toEqual(
      expect.objectContaining({
        providerId: "pinned-provider",
        model: "pinned-model",
      }),
    );
  });

  it("should use pinned provider and defaultModel when pinnedModel is not specified", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "pinned-provider",
      },
    ]);
    mockGetProvider.mockReturnValue({
      defaultModel: "provider-default-model",
      supportsStreaming: true,
      format: "openai",
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        provider: "pinned-provider",
        model: "provider-default-model",
      }),
    });
  });

  it("should fall back to orchestrator model when pinnedProvider lookup returns undefined", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "unknown-provider",
      },
    ]);
    mockGetProvider.mockReturnValue(undefined);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        provider: "unknown-provider",
        model: "test-model",
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

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
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

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invoke",
        payload: expect.objectContaining({
          model: "anthropic.claude-opus-4-8",
          maxTokens: 100000,
        }),
      }),
    );
  });

  it("should fall back to orchestrator maxTokens when pinnedMaxTokens is invalid", async () => {
    mockOrchestrator.maxTokens = 5000;
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        pinnedProvider: "test-provider",
        pinnedModel: "test-model",
        pinnedMaxTokens: -10,
      },
    ]);

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "invoke",
        payload: expect.objectContaining({
          maxTokens: 5000,
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
    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalled();
  });

  it("should skip history when freshContext is true and messages exist", async () => {
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

  it("should seed freshContext with trigger message when conversation history is empty", async () => {
    mockBuildConversationMessages.mockResolvedValue([]);

    await invokeAgent(
      mockOrchestrator,
      mockDb,
      "group1",
      "first trigger",
      true,
    );

    expect(mockBuildDynamicContext).toHaveBeenCalledWith(
      [{ role: "user", content: "first trigger" }],
      expect.any(Object),
    );
  });

  it("should pass subagentTask true when subagent is true", async () => {
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello", false, true);

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        subagentTask: true,
      }),
    });
  });

  it("should execute subagent task using an isolated groupId and not set parent groupId to thinking", async () => {
    mockUlid.mockReturnValue("subagent-ulid");
    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello", false, true);

    expect(mockOrchestrator.setState).toHaveBeenCalledWith(
      "thinking",
      "subagent:subagent-ulid",
    );
    expect(mockOrchestrator.router?.setTyping).toHaveBeenCalledWith(
      "subagent:subagent-ulid",
      true,
    );

    expect(mockOrchestrator.setState).not.toHaveBeenCalledWith(
      "thinking",
      "group1",
    );
    expect(mockOrchestrator.router?.setTyping).not.toHaveBeenCalledWith(
      "group1",
      true,
    );

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
      type: "invoke",
      payload: expect.objectContaining({
        groupId: "subagent:subagent-ulid",
        subagentTask: true,
      }),
    });
  });

  it("should filter declarative tools by toolTags when toolTags are set on group", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
        toolTags: ["generate_random_number", "tool1"],
      },
    ]);
    mockLoadDeclarativeTools.mockResolvedValue({
      tools: [
        { name: "generate_random_number", description: "random number" },
        { name: "unpinned_declarative_tool", description: "other tool" },
      ],
      diagnostics: [],
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    const postCall = (
      mockOrchestrator.agentWorker?.postMessage as unknown as jest.Mock
    ).mock.calls[0][0] as {
      payload: { enabledTools: Array<{ name: string }> };
    };
    const enabledToolNames = postCall.payload.enabledTools.map((t) => t.name);
    expect(enabledToolNames).toContain("generate_random_number");
    expect(enabledToolNames).toContain("tool1");
    expect(enabledToolNames).not.toContain("unpinned_declarative_tool");
  });

  it("should filter out disabled declarative tools when enabledTools payload is constructed", async () => {
    mockListGroups.mockResolvedValue([
      {
        groupId: "group1",
      },
    ]);
    mockLoadDeclarativeTools.mockResolvedValue({
      tools: [
        { name: "generate_random_number", description: "random number" },
        { name: "disabled_decl_tool", description: "disabled tool" },
      ],
      diagnostics: [],
    });

    await invokeAgent(mockOrchestrator, mockDb, "group1", "hello");

    const postCall = (
      mockOrchestrator.agentWorker?.postMessage as unknown as jest.Mock
    ).mock.calls[0][0] as {
      payload: { enabledTools: Array<{ name: string }> };
    };
    const enabledToolNames = postCall.payload.enabledTools.map((t) => t.name);
    expect(enabledToolNames).toContain("generate_random_number");
    expect(enabledToolNames).not.toContain("disabled_decl_tool");
  });
});
