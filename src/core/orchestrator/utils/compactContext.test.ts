import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../../../config/config.js";
import type { ProviderConfig } from "../../../config/config.js";
import type { ConversationMessage } from "../../../content/types.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { GroupMeta } from "../../../db/types.js";
import type { Orchestrator } from "../orchestrator.js";

const mockReadGroupFile =
  jest.fn<
    (
      db: ShadowClawDatabase,
      groupId: string,
      filename: string,
    ) => Promise<string>
  >();
jest.unstable_mockModule("../../../storage/readGroupFile.js", () => ({
  readGroupFile: mockReadGroupFile,
}));

const mockBuildConversationMessages =
  jest.fn<(groupId: string, limit: number) => Promise<ConversationMessage[]>>();
jest.unstable_mockModule("../../../db/buildConversationMessages.js", () => ({
  buildConversationMessages: mockBuildConversationMessages,
}));

const mockGetConfig =
  jest.fn<(db: ShadowClawDatabase, key: string) => Promise<string | null>>();
jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

let mockGroupsList: GroupMeta[] = [];
jest.unstable_mockModule("../../../db/groups.js", () => ({
  getGroupMetadata: jest.fn<() => Promise<GroupMeta[]>>().mockResolvedValue([]),
  saveGroupMetadata: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  createGroup: jest
    .fn<() => Promise<GroupMeta>>()
    .mockResolvedValue({} as GroupMeta),
  renameGroup: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  updateGroupToolTags: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  deleteGroupMetadata: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  listGroups: jest.fn<() => Promise<GroupMeta[]>>(async () => mockGroupsList),
  reorderGroups: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  cloneGroup: jest
    .fn<() => Promise<GroupMeta>>()
    .mockResolvedValue({} as GroupMeta),
  updateGroupPinnedProvider: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  updateGroupSubagentSettings: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  updateGroupProviderRuntimeOverrides: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
}));

const mockEnsureBuiltinAiPolyfills = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
const mockSummarizeText = jest
  .fn<(text: string, options: unknown) => Promise<string>>()
  .mockResolvedValue("Mock task summary");
jest.unstable_mockModule(
  "../../../subsystems/providers/builtin-ai-tasks.js",
  () => ({
    ensureBuiltinAiPolyfills: mockEnsureBuiltinAiPolyfills,
    summarizeText: mockSummarizeText,
    writeText: jest.fn<() => Promise<string>>().mockResolvedValue(""),
    rewriteText: jest.fn<() => Promise<string>>().mockResolvedValue(""),
    detectLanguage: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    translateText: jest.fn<() => Promise<string>>().mockResolvedValue(""),
    proofreadText: jest.fn<() => Promise<string>>().mockResolvedValue(""),
    embedText: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    isBuiltinTaskSupported: jest.fn<() => boolean>(() => true),
    getPromptApiFallbackModel: jest
      .fn<() => Promise<string>>()
      .mockResolvedValue(""),
    createTaskInstanceWithFallback: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({}),
    isWebGpuAdapterAvailable: jest
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(false),
  }),
);

const mockIsPromptApiSupported = jest.fn<() => boolean>().mockReturnValue(true);
const mockCompactWithPromptApi = jest
  .fn<
    (
      systemPrompt: string,
      messages: unknown[],
      signal: AbortSignal,
      onMessage: (msg: unknown) => Promise<void>,
      groupId: string,
    ) => Promise<string>
  >()
  .mockResolvedValue("Mock prompt API summary");

jest.unstable_mockModule(
  "../../../subsystems/providers/prompt-api-provider.js",
  () => ({
    isPromptApiSupported: mockIsPromptApiSupported,
    compactWithPromptApi: mockCompactWithPromptApi,
    invokeWithPromptApi: jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);

const mockDeliverResponse = jest
  .fn<
    (
      o: Orchestrator,
      db: ShadowClawDatabase,
      groupId: string,
      text: string,
    ) => Promise<void>
  >()
  .mockResolvedValue(undefined);

jest.unstable_mockModule("./deliverResponse.js", () => ({
  deliverResponse: mockDeliverResponse,
}));

const mockHandleWorkerMessage = jest
  .fn<
    (o: Orchestrator, db: ShadowClawDatabase, msg: unknown) => Promise<void>
  >()
  .mockResolvedValue(undefined);

jest.unstable_mockModule("./handleWorkerMessage.js", () => ({
  handleWorkerMessage: mockHandleWorkerMessage,
}));

let mockPeerState: unknown = null;
jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    getPeerState: jest.fn(() => mockPeerState),
  },
}));

const { compactContext } = await import("./compactContext.js");
const { Orchestrator: Orch } = await import("../orchestrator.js");

describe("compactContext", () => {
  let db: ShadowClawDatabase;
  let o: Orchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    db = {} as unknown as ShadowClawDatabase;
    mockPeerState = null;
    mockGroupsList = [
      {
        groupId: "group-pinned",
        name: "Pinned Group",
        createdAt: Date.now(),
        pinnedProvider: "transformers_js_local",
        pinnedModel: "onnx-community/Llama-3.2-1B-Instruct",
      },
      {
        groupId: "group-pinned-no-model",
        name: "Pinned Group No Model",
        createdAt: Date.now(),
        pinnedProvider: "openrouter",
      },
      {
        groupId: "group-pinned-unknown-prov",
        name: "Pinned Group Unknown Prov",
        createdAt: Date.now(),
        pinnedProvider: "unknown_prov_xyz",
      },
    ];

    mockReadGroupFile.mockRejectedValue(new Error("File not found"));
    mockBuildConversationMessages.mockResolvedValue([]);
    mockGetConfig.mockResolvedValue(null);
    mockIsPromptApiSupported.mockReturnValue(true);

    o = new Orch();
    jest.spyOn(o, "getApiKey").mockResolvedValue("valid-api-key");
    o.provider = "openrouter";
    o.model = "openai/gpt-4o";
    o.providerConfig = {
      id: "openrouter",
      name: "OpenRouter",
      defaultModel: "openai/gpt-4o",
      requiresApiKey: false,
    } as ProviderConfig;
    o.agentWorker = { postMessage: jest.fn() } as unknown as Worker;
    o.handleCompactDone = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);
  });

  it("should emit error and provider-help if provider requires API key and none is set", async () => {
    o.provider = "openrouter";
    o.providerConfig = {
      id: "openrouter",
      name: "OpenRouter",
      defaultModel: "openai/gpt-4o",
      requiresApiKey: true,
    } as ProviderConfig;
    jest.spyOn(o, "getApiKey").mockResolvedValue("");

    const helpEvents: unknown[] = [];
    const errorEvents: unknown[] = [];
    o.events.on("provider-help", (e) => helpEvents.push(e));
    o.events.on("error", (e) => errorEvents.push(e));

    await compactContext(o, db, "group-1");

    expect(helpEvents).toHaveLength(1);
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual({
      groupId: "group-1",
      error: "API key not configured. Cannot compact context.",
    });
  });

  it("should fetch specific API key when effective provider differs from orchestrator provider", async () => {
    const specificApiKeySpy = jest
      .spyOn(o, "getApiKeyForSpecificProvider")
      .mockResolvedValueOnce("specific-key");
    mockGroupsList.push({
      groupId: "group-different-prov",
      name: "Diff Prov",
      createdAt: Date.now(),
      pinnedProvider: "anthropic",
      pinnedModel: "claude-3-5-sonnet",
    });

    await compactContext(o, db, "group-different-prov");

    expect(specificApiKeySpy).toHaveBeenCalledWith(db, "anthropic");
    expect(o.agentWorker?.postMessage).toHaveBeenCalled();
  });

  it("should emit error and abort if orchestrator state is not idle", async () => {
    o.setState("thinking");

    const errorEvents: unknown[] = [];
    o.events.on("error", (e) => errorEvents.push(e));

    await compactContext(o, db, "group-1");

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual({
      groupId: "group-1",
      error:
        "Cannot compact while processing. Wait for the current response to finish.",
    });
  });

  it("should read memory from MEMORY.md if available", async () => {
    mockReadGroupFile.mockResolvedValueOnce("# Context Memory");

    await compactContext(o, db, "group-1");

    const postMessage = o.agentWorker?.postMessage as jest.Mock;
    expect(postMessage).toHaveBeenCalled();
    const payload = postMessage.mock.calls[0][0] as {
      payload: { memory: string };
    };
    expect(payload.payload.memory).toBe("# Context Memory");
  });

  it("should use peerState from orchestratorStore when available", async () => {
    mockPeerState = { peerId: "peer-abc", typing: true };

    await compactContext(o, db, "group-1");

    expect(o.agentWorker?.postMessage).toHaveBeenCalled();
  });

  it("should resolve fallback model for prompt_api when browser-built-in and not supported", async () => {
    o.provider = "prompt_api";
    o.model = "browser-built-in";
    mockIsPromptApiSupported.mockReturnValue(false);
    mockGetConfig.mockImplementation(async (_db, key) => {
      if (key === CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL) {
        return "custom-fallback-model";
      }
      return null;
    });

    await compactContext(o, db, "group-1");

    expect(mockEnsureBuiltinAiPolyfills).toHaveBeenCalled();
  });

  it("should resolve default fallback model when PROMPT_API_FALLBACK_MODEL is null", async () => {
    o.provider = "prompt_api";
    o.model = "";
    mockIsPromptApiSupported.mockReturnValue(false);
    mockGetConfig.mockResolvedValue(null);

    await compactContext(o, db, "group-1");

    expect(mockEnsureBuiltinAiPolyfills).toHaveBeenCalled();
  });

  it("should handle pinned provider without pinned model using defaultModel or fallback", async () => {
    await compactContext(o, db, "group-pinned-no-model");
    const postMessage = o.agentWorker?.postMessage as jest.Mock;
    expect(postMessage).toHaveBeenCalled();
    const payload = postMessage.mock.calls[0][0] as {
      payload: { provider: string };
    };
    expect(payload.payload.provider).toBe("openrouter");

    // Also test group with unknown pinned provider
    o.setState("idle");
    jest
      .spyOn(o, "getApiKeyForSpecificProvider")
      .mockResolvedValue("specific-key");
    await compactContext(o, db, "group-pinned-unknown-prov");
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("should default groupId to DEFAULT_GROUP_ID when omitted", async () => {
    await compactContext(o, db);
    const postMessage = o.agentWorker?.postMessage as jest.Mock;
    expect(postMessage).toHaveBeenCalled();
    const payload = postMessage.mock.calls[0][0] as {
      payload: { groupId: string };
    };
    expect(payload.payload.groupId).toBe(DEFAULT_GROUP_ID);
  });

  describe("compactionPref === builtin_task_api", () => {
    it("should summarize messages and call handleCompactDone on success", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.COMPACTION_ENGINE_PREFERENCE) {
          return "builtin_task_api";
        }
        return null;
      });
      mockBuildConversationMessages.mockResolvedValueOnce([
        { role: "user", content: "Hello" },
        { role: "assistant", content: { text: "World" } as unknown as string },
      ]);

      await compactContext(o, db, "group-1");

      expect(mockSummarizeText).toHaveBeenCalled();
      expect(o.handleCompactDone).toHaveBeenCalledWith(
        db,
        "group-1",
        "Mock task summary",
      );
    });

    it("should catch error in summarizeText and deliver fallback response", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.COMPACTION_ENGINE_PREFERENCE) {
          return "builtin_task_api";
        }
        return null;
      });
      mockSummarizeText.mockRejectedValueOnce(new Error("Summarizer failed"));

      await compactContext(o, db, "group-1");

      expect(mockDeliverResponse).toHaveBeenCalledWith(
        o,
        db,
        "group-1",
        "⚠️ Built-in Task API compaction failed, falling back to provider: Summarizer failed",
      );
      expect(o.agentWorker?.postMessage).toHaveBeenCalled();
    });

    it("should catch non-Error thrown in summarizeText and deliver fallback response", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.COMPACTION_ENGINE_PREFERENCE) {
          return "builtin_task_api";
        }
        return null;
      });
      mockSummarizeText.mockRejectedValueOnce("Non-error string failure");

      await compactContext(o, db, "group-1");

      expect(mockDeliverResponse).toHaveBeenCalledWith(
        o,
        db,
        "group-1",
        "⚠️ Built-in Task API compaction failed, falling back to provider: Non-error string failure",
      );
    });
  });

  describe("effectiveProviderId === prompt_api", () => {
    it("should abort if prompt_api remains unsupported after polyfill attempt", async () => {
      o.provider = "prompt_api";
      mockIsPromptApiSupported.mockReturnValue(false);

      const errorEvents: unknown[] = [];
      const typingEvents: unknown[] = [];
      o.events.on("error", (e) => errorEvents.push(e));
      o.events.on("typing", (e) => typingEvents.push(e));

      await compactContext(o, db, "group-1");

      expect(mockEnsureBuiltinAiPolyfills).toHaveBeenCalled();
      expect(errorEvents).toHaveLength(1);
      expect(typingEvents).toContainEqual({
        groupId: "group-1",
        typing: false,
      });
      expect(o.state).toBe("idle");
    });

    it("should execute compactWithPromptApi, trigger handleWorkerMessage callback, and call handleCompactDone", async () => {
      o.provider = "prompt_api";
      mockIsPromptApiSupported.mockReturnValue(true);

      await compactContext(o, db, "group-1");

      expect(mockCompactWithPromptApi).toHaveBeenCalled();
      const onMsgCb = mockCompactWithPromptApi.mock.calls[0][3];
      await onMsgCb({ type: "stream-chunk" });
      expect(mockHandleWorkerMessage).toHaveBeenCalledWith(o, db, {
        type: "stream-chunk",
      });

      expect(o.handleCompactDone).toHaveBeenCalledWith(
        db,
        "group-1",
        "Mock prompt API summary",
      );
      expect(o.promptControllers.has("group-1")).toBe(false);
    });

    it("should return early when compactWithPromptApi throws AbortError", async () => {
      o.provider = "prompt_api";
      mockIsPromptApiSupported.mockReturnValue(true);

      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockCompactWithPromptApi.mockRejectedValueOnce(abortError);

      await compactContext(o, db, "group-1");

      expect(mockDeliverResponse).not.toHaveBeenCalled();
      expect(o.promptControllers.has("group-1")).toBe(false);
    });

    it("should deliver error response when compactWithPromptApi throws regular Error", async () => {
      o.provider = "prompt_api";
      mockIsPromptApiSupported.mockReturnValue(true);

      mockCompactWithPromptApi.mockRejectedValueOnce(
        new Error("Prompt API crash"),
      );

      await compactContext(o, db, "group-1");

      expect(mockDeliverResponse).toHaveBeenCalledWith(
        o,
        db,
        "group-1",
        "⚠️ Error: Compaction failed: Prompt API crash",
      );
      expect(o.promptControllers.has("group-1")).toBe(false);
    });

    it("should deliver error response when compactWithPromptApi throws non-Error", async () => {
      o.provider = "prompt_api";
      mockIsPromptApiSupported.mockReturnValue(true);

      mockCompactWithPromptApi.mockRejectedValueOnce("String error thrown");

      await compactContext(o, db, "group-1");

      expect(mockDeliverResponse).toHaveBeenCalledWith(
        o,
        db,
        "group-1",
        "⚠️ Error: Compaction failed: String error thrown",
      );
      expect(o.promptControllers.has("group-1")).toBe(false);
    });
  });
});
