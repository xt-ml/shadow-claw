import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ProviderConfig } from "../../../config/config.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

jest.unstable_mockModule("./operations/channel.js", () => ({
  applyAllChannelRunningStates: jest.fn(),
  applyChannelRunningState: jest.fn(),
  clearPeerJsTypingState: jest.fn(),
  getChannelByType: jest.fn(),
  getChannelEnabled: jest.fn(),
  getChannelEnabledConfigKey: jest.fn(),
  getChannelTypeForGroup: jest.fn(),
  loadChannelEnabled: jest.fn(),
  setChannelEnabled: jest.fn(),
  shouldRunChannel: jest.fn(),
}));

const mockDeliverResponse = jest
  .fn<(...args: unknown[]) => Promise<unknown>>()
  .mockResolvedValue(undefined);
const mockDeliverIntermediateResponse = jest
  .fn<(...args: unknown[]) => Promise<unknown>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule("./deliverResponse.js", () => ({
  deliverResponse: mockDeliverResponse,
  deliverIntermediateResponse: mockDeliverIntermediateResponse,
}));

jest.unstable_mockModule("./operations/room.js", () => ({
  createRoom: jest.fn(),
  handleRoomInvite: jest.fn(),
  inviteToRoom: jest.fn(),
  joinRoomViaLink: jest.fn(),
  leaveRoom: jest.fn(),
  listRooms: jest.fn(),
}));

const mockIsLlamafileResolutionError =
  jest.fn<(...args: unknown[]) => boolean>();
const mockDetectProviderHelpType =
  jest.fn<(...args: unknown[]) => string | null>();
const mockIsTransformersJsResolutionError =
  jest.fn<(...args: unknown[]) => boolean>();

const mockDeleteTask = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetAllTasks = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRoomIdFromGroupId = jest.fn<(...args: unknown[]) => string>();
const mockSaveTask = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetOrCreateSubscriberId =
  jest.fn<(...args: unknown[]) => Promise<string>>();

const mockSyncTaskToServer =
  jest.fn<(...args: unknown[]) => Promise<boolean>>();
const mockDeleteTaskFromServer =
  jest.fn<(...args: unknown[]) => Promise<boolean>>();

const mockGetRemoteMcpConnection =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockReconnectMcpOAuth =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetPushUrl = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockGetConfig = jest.fn<(...args: unknown[]) => Promise<unknown>>();

const mockShowToast = jest.fn<(...args: unknown[]) => unknown>();

jest.unstable_mockModule(
  "../../../components/common/help/llamafile.js",
  () => ({
    isLlamafileResolutionError: mockIsLlamafileResolutionError,
  }),
);

jest.unstable_mockModule(
  "../../../components/common/help/providers.js",
  () => ({
    detectProviderHelpType: mockDetectProviderHelpType,
  }),
);

jest.unstable_mockModule(
  "../../../components/common/help/transformers.js",
  () => ({
    isTransformersJsResolutionError: mockIsTransformersJsResolutionError,
  }),
);

jest.unstable_mockModule("../../../config/config.js", () => ({
  getProvider: jest.fn(),
  GENERAL_ACCOUNT_PROVIDER_CAPABILITIES: [],
  getGeneralAccountProviderCapabilities: jest.fn(),
  getProviderTokenAuthScheme: jest.fn(),
  DEFAULT_DEV_HOST: "http://localhost:8888",
  DEFAULT_DEV_PORT: 8888,
  BASH_DEFAULT_TIMEOUT_SEC: 60,
  BASH_MAX_TIMEOUT_SEC: 300,
  DEFAULT_VM_NETWORK_RELAY_URL: "",
  DEFAULT_SUBAGENT_MAX_PARALLEL: 5,
  DEFAULT_SUBAGENT_WORKSPACE_MODE: "automatic",
  FETCH_MAX_RESPONSE: 50 * 1024 * 1024,
  ASSISTANT_NAME: "Assistant",
  PROVIDERS: {},
  OAUTH_PROVIDER_DEFINITIONS: {},
  getProviderApiKeyConfigKey: jest.fn(),
  CONFIG_KEYS: {},
  DEFAULT_PROMPT_API_FALLBACK_MODEL: "onnx-community/Qwen3-0.6B-ONNX",
  getModelMaxTokens: jest.fn().mockReturnValue(128000),
  buildTriggerPattern: jest.fn().mockReturnValue(new RegExp("")),
  DEFAULT_GROUP_ID: "br:main",
  OPFS_ROOT: "shadowclaw",
  LLAMAFILE_PROXY_URL: "/proxy/llamafile",
}));

jest.unstable_mockModule("../../../db/deleteTask.js", () => ({
  deleteTask: mockDeleteTask,
}));

jest.unstable_mockModule("../../../db/getAllTasks.js", () => ({
  getAllTasks: mockGetAllTasks,
}));

jest.unstable_mockModule("../../../db/rooms.js", () => ({
  roomIdFromGroupId: mockRoomIdFromGroupId,
  ROOM_PREFIX: "room:",
  roomGroupId: (id: string) => `room:${id}`,
  getRoomMetadata: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  saveRoomMetadata: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getRoom: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  upsertRoom: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  createRoom: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
  addRoomMember: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  removeRoomMember: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  deleteRoom: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/saveTask.js", () => ({
  saveTask: mockSaveTask,
}));

jest.unstable_mockModule("../../../db/getOrCreateSubscriberId.js", () => ({
  getOrCreateSubscriberId: mockGetOrCreateSubscriberId,
}));

interface MockOrchestratorStore {
  runTask: jest.Mock;
}

const mockOrchestratorStore: MockOrchestratorStore = {
  runTask: jest.fn(),
};

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: mockOrchestratorStore,
}));

jest.unstable_mockModule(
  "../../../core/orchestrator/utils/operations/task.js",
  () => ({
    syncTaskToServer: mockSyncTaskToServer,
    deleteTaskFromServer: mockDeleteTaskFromServer,
  }),
);

const mockToolsStore = {
  activateProfile: jest.fn<(...args: unknown[]) => Promise<void>>(),
  setToolEnabled: jest.fn<(...args: unknown[]) => Promise<void>>(),
  enabledTools: ["t1"],
  systemPromptOverride: "override",
};

jest.unstable_mockModule("../../../stores/tools.js", () => ({
  toolsStore: mockToolsStore,
}));

jest.unstable_mockModule("../../../subsystems/mcp/mcp-connections.js", () => ({
  getRemoteMcpConnection: mockGetRemoteMcpConnection,
  listRemoteMcpConnections: jest
    .fn<() => Promise<unknown[]>>()
    .mockResolvedValue([]),
}));

jest.unstable_mockModule("../../../subsystems/mcp/mcp-reconnect.js", () => ({
  reconnectMcpOAuth: mockReconnectMcpOAuth,
}));

jest.unstable_mockModule(
  "../../../subsystems/notifications/push-client.js",
  () => ({
    getPushUrl: mockGetPushUrl,
  }),
);

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showToast: mockShowToast,
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

const mockGetApiKeyForRequest =
  jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockGetProviderRuntimeHeaders =
  jest.fn<(...args: unknown[]) => Record<string, string>>();
const mockStopTransformersProgressPolling =
  jest.fn<(...args: unknown[]) => unknown>();

jest.unstable_mockModule("./operations/provider.js", () => ({
  getApiKeyForRequest: mockGetApiKeyForRequest,
  getProviderRuntimeHeaders: mockGetProviderRuntimeHeaders,
  stopTransformersProgressPolling: mockStopTransformersProgressPolling,
  getTransformersStatusUrl: jest.fn(),
  pollTransformersProgress: jest.fn(),
  startTransformersProgressPolling: jest.fn(),
}));

const mockBuildHeaders =
  jest.fn<(...args: unknown[]) => Record<string, string>>();
const mockFormatRequest =
  jest.fn<(...args: unknown[]) => Record<string, unknown>>();
const mockParseResponse =
  jest.fn<(...args: unknown[]) => Record<string, unknown>>();

jest.unstable_mockModule("../../../subsystems/providers/providers.js", () => ({
  buildHeaders: mockBuildHeaders,
  formatRequest: mockFormatRequest,
  getContextLimit: jest.fn().mockReturnValue(128000),
  normalizeMeshLlmResult: jest.fn().mockImplementation((r) => r),
  parseResponse: mockParseResponse,
}));

const mockSummarizeText = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockWriteText = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRewriteText = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockProofreadText = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDetectLanguage = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockTranslateText = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockEmbedText = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockEnsureBuiltinAiPolyfills =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.unstable_mockModule(
  "../../../subsystems/providers/builtin-ai-tasks.js",
  () => ({
    detectLanguage: mockDetectLanguage,
    embedText: mockEmbedText,
    ensureBuiltinAiPolyfills: mockEnsureBuiltinAiPolyfills,
    proofreadText: mockProofreadText,
    rewriteText: mockRewriteText,
    summarizeText: mockSummarizeText,
    translateText: mockTranslateText,
    writeText: mockWriteText,
    createTaskInstanceWithFallback: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({}),
    getPromptApiFallbackModel: jest
      .fn<() => Promise<string>>()
      .mockResolvedValue("onnx-community/Qwen3-0.6B-ONNX"),
    PROMPT_API_POLYFILL_MODEL: "onnx-community/Qwen3-0.6B-ONNX",
  }),
);

const { handleWorkerMessage } = await import("./handleWorkerMessage.js");
const { createRoom, inviteToRoom, leaveRoom } =
  await import("./operations/room.js");

interface PendingResolver {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

const globalNativeAi = globalThis as typeof globalThis & {
  pendingNativeAiResolvers?: Record<string, PendingResolver>;
  LanguageModel?: {
    create: () => Promise<{
      prompt: (p?: string) => Promise<string>;
      destroy: () => void;
    }>;
  };
};

const dummyProviderConfig: ProviderConfig = {
  id: "test-prov",
  name: "Test Provider",
  baseUrl: "https://api.test.example/v1",
  format: "openai",
  requiresApiKey: true,
  apiKeyHeader: "Authorization",
  headers: {},
  supportsStreaming: true,
  defaultModel: "test-model",
};

describe("handleWorkerMessage", () => {
  let mockOrchestrator: Orchestrator;
  let mockDb: ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncTaskToServer.mockResolvedValue(true);
    mockDeleteTaskFromServer.mockResolvedValue(true);
    mockGetOrCreateSubscriberId.mockResolvedValue("sub-test");

    mockDb = {} as unknown as ShadowClawDatabase;
    mockOrchestrator = {
      transformersProgressPollers: new Map<string, unknown>(),
      clearProviderRequest: jest.fn(),
      inFlightTriggerByGroup: new Map<string, string>(),
      inFlightEffectiveProviderByGroup: new Map<string, unknown>(),
      deliverResponse: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(undefined),
      deliverIntermediateResponse: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(undefined),
      setState: jest.fn(),
      events: { emit: jest.fn() },
      schedulerTriggeredGroups: new Set<string>(),
      createRoom: jest.fn(),
      inviteToRoom: jest.fn(),
      leaveRoom: jest.fn(),
      getProvider: jest.fn().mockReturnValue("test-prov"),
      providerConfig: { requiresApiKey: true },
      router: {
        setTyping: jest.fn(),
        send: jest
          .fn<(...args: unknown[]) => Promise<unknown>>()
          .mockResolvedValue(undefined),
        findChannel: jest.fn(),
      },
      newSession: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(undefined),
      handleCompactDone: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(undefined),
      agentWorker: { postMessage: jest.fn() },
      roomManager: { broadcastA2UI: jest.fn() },
      maxTokens: 1000,
      provider: "test-provider",
      model: "test-model",
    } as unknown as Orchestrator;

    mockGetPushUrl.mockResolvedValue("http://push");
    mockGetAllTasks.mockResolvedValue([]);
    mockGetApiKeyForRequest.mockResolvedValue("api-key");
    mockGetProviderRuntimeHeaders.mockReturnValue({});
    mockStopTransformersProgressPolling.mockReturnValue(undefined);
    mockBuildHeaders.mockReturnValue({ Authorization: "Bearer api-key" });
    mockFormatRequest.mockReturnValue({ model: "placeholder", messages: [] });
    mockParseResponse.mockReturnValue({
      content: [{ type: "text", text: "parsed result" }],
    });
    global.fetch = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({} as unknown as Response) as typeof global.fetch;
  });

  const send = async (msg: { type: string; payload?: unknown }) =>
    handleWorkerMessage(
      mockOrchestrator,
      mockDb,
      msg as Record<string, unknown>,
    );

  it("handles response", async () => {
    mockOrchestrator.inFlightTriggerByGroup.set("g1", "x");
    await send({ type: "response", payload: { groupId: "g1", text: "hi" } });
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "g1",
      "hi",
    );
    expect(mockOrchestrator.inFlightTriggerByGroup.has("g1")).toBe(false);
  });

  it("handles streaming events", async () => {
    await send({ type: "streaming-start", payload: { groupId: "g1" } });
    expect(mockOrchestrator.setState).toHaveBeenCalledWith("responding", "g1");

    await send({
      type: "streaming-chunk",
      payload: { groupId: "g1", text: "a" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "streaming-chunk",
      { groupId: "g1", text: "a" },
    );

    await send({
      type: "intermediate-response",
      payload: { groupId: "g1", text: "b" },
    });
    expect(mockDeliverIntermediateResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "g1",
      "b",
    );

    await send({ type: "streaming-end", payload: { groupId: "g1" } });
    expect(mockOrchestrator.setState).toHaveBeenCalledWith("thinking", "g1");

    await send({ type: "streaming-done", payload: { groupId: "g1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "streaming-done",
      { groupId: "g1" },
    );

    await send({
      type: "streaming-error",
      payload: { groupId: "g1", error: "err" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "streaming-error",
      { groupId: "g1", error: "err" },
    );
  });

  it("handles run-task", async () => {
    await send({ type: "run-task", payload: { task: { id: "t1" } } });
    expect(mockOrchestratorStore.runTask).toHaveBeenCalledWith(
      { id: "t1" },
      true,
    );
  });

  it("handles task-created success and failures", async () => {
    mockOrchestrator.schedulerTriggeredGroups.add("g1");
    await send({ type: "task-created", payload: { task: { groupId: "g1" } } });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("blocked"),
      expect.any(Object),
    );
    mockOrchestrator.schedulerTriggeredGroups.clear();

    await send({ type: "task-created", payload: { task: { groupId: "g2" } } });
    expect(mockSaveTask).toHaveBeenCalled();
    expect(mockSyncTaskToServer).toHaveBeenLastCalledWith(
      mockOrchestrator,
      { groupId: "g2" },
      "sub-test",
    );

    // Sync to server failed
    mockSyncTaskToServer.mockResolvedValueOnce(false);
    await send({ type: "task-created", payload: { task: { groupId: "g2" } } });
    expect(mockShowToast).toHaveBeenCalledWith(
      "Failed to sync task to server — task was not saved.",
      { type: "error" },
    );

    // Save task throws error
    mockSaveTask.mockRejectedValueOnce(new Error("Save failed"));
    await send({ type: "task-created", payload: { task: { groupId: "g2" } } });
    expect(mockShowToast).toHaveBeenCalledWith("Failed to save task.", {
      type: "error",
    });
  });

  it("handles update-task success and failures", async () => {
    mockOrchestrator.schedulerTriggeredGroups.add("g1");
    await send({ type: "update-task", payload: { task: { groupId: "g1" } } });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("Task update blocked"),
      expect.any(Object),
    );
    mockOrchestrator.schedulerTriggeredGroups.clear();

    await send({ type: "update-task", payload: { task: { groupId: "g2" } } });
    expect(mockSaveTask).toHaveBeenCalled();
    expect(mockSyncTaskToServer).toHaveBeenLastCalledWith(
      mockOrchestrator,
      { groupId: "g2" },
      "sub-test",
    );

    // Sync to server failed
    mockSyncTaskToServer.mockResolvedValueOnce(false);
    await send({ type: "update-task", payload: { task: { groupId: "g2" } } });
    expect(mockShowToast).toHaveBeenCalledWith(
      "Failed to sync task update to server — task was not updated.",
      { type: "error" },
    );

    // Update throws error
    mockSaveTask.mockRejectedValueOnce(new Error("Update failed"));
    await send({ type: "update-task", payload: { task: { groupId: "g2" } } });
    expect(mockShowToast).toHaveBeenCalledWith("Failed to update task.", {
      type: "error",
    });
  });

  it("handles delete-task success and failures", async () => {
    mockOrchestrator.schedulerTriggeredGroups.add("g1");
    await send({ type: "delete-task", payload: { id: "t1", groupId: "g1" } });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("Task deletion blocked"),
      expect.any(Object),
    );
    mockOrchestrator.schedulerTriggeredGroups.clear();

    await send({ type: "delete-task", payload: { id: "t1", groupId: "g2" } });
    expect(mockDeleteTask).toHaveBeenCalled();
    expect(mockDeleteTaskFromServer).toHaveBeenCalledWith(
      mockOrchestrator,
      "t1",
      "sub-test",
    );

    // Server deletion failed
    mockDeleteTaskFromServer.mockResolvedValueOnce(false);
    await send({ type: "delete-task", payload: { id: "t1", groupId: "g2" } });
    expect(mockShowToast).toHaveBeenCalledWith(
      "Failed to delete task from server — task kept in view.",
      { type: "error" },
    );

    // Delete task throws
    mockDeleteTask.mockRejectedValueOnce(new Error("Delete failed"));
    await send({ type: "delete-task", payload: { id: "t1", groupId: "g2" } });
  });

  it("handles task-list-request filtering by groupId", async () => {
    mockGetAllTasks.mockResolvedValue([
      { id: "t1", groupId: "g1" },
      { id: "t2", groupId: "g2" },
    ]);

    await send({ type: "task-list-request", payload: { groupId: "g1" } });

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
      type: "task-list-response",
      payload: {
        groupId: "g1",
        tasks: [{ id: "t1", groupId: "g1" }],
      },
    });
  });

  it("handles room actions and edge cases", async () => {
    await send({
      type: "room-action",
      payload: { action: "create", name: "r1" },
    });
    expect(createRoom).toHaveBeenCalledWith(mockOrchestrator, "r1");

    await send({
      type: "room-action",
      payload: { action: "create" },
    });
    expect(createRoom).toHaveBeenCalledWith(mockOrchestrator, "");

    await send({
      type: "room-action",
      payload: { action: "invite", roomId: "r1", peerId: "p1" },
    });
    expect(inviteToRoom).toHaveBeenCalledWith(mockOrchestrator, "r1", "p1");

    await send({
      type: "room-action",
      payload: { action: "leave", roomId: "r1" },
    });
    expect(leaveRoom).toHaveBeenCalledWith(mockOrchestrator, "r1");

    // Unknown action does not crash
    await send({
      type: "room-action",
      payload: { action: "unknown" },
    });

    // Thrown error is caught cleanly
    (leaveRoom as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Leave error");
    });
    await send({
      type: "room-action",
      payload: { action: "leave", roomId: "r1" },
    });
  });

  it("handles errors and context limit warnings", async () => {
    await send({
      type: "error",
      payload: { groupId: "g1", error: "tokens_limit_reached" },
    });
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "g1",
      expect.stringContaining("context window"),
    );

    // Non-context error
    await send({
      type: "error",
      payload: { groupId: "g1", error: "Unrelated provider fault" },
    });
    expect(mockDeliverResponse).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "g1",
      "⚠️ Error: Unrelated provider fault",
    );
  });

  it("handles llamafile error and transformers_js_local error", async () => {
    mockOrchestrator.inFlightEffectiveProviderByGroup.set("g1", {
      providerId: "llamafile",
      model: "llamafile-model",
      providerConfig: dummyProviderConfig,
    });
    mockIsLlamafileResolutionError.mockReturnValue(true);
    await send({
      type: "error",
      payload: { groupId: "g1", error: "llama err" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "provider-help",
      expect.objectContaining({ providerId: "llamafile" }),
    );

    mockOrchestrator.inFlightEffectiveProviderByGroup.set("g2", {
      providerId: "transformers_js_local",
      model: "local-model",
      providerConfig: dummyProviderConfig,
    });
    mockIsTransformersJsResolutionError.mockReturnValue(true);
    await send({
      type: "error",
      payload: { groupId: "g2", error: "transformers local error" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("provider-help", {
      providerId: "transformers_js_local",
      reason: "transformers local error",
    });
  });

  it("handles generic provider help detection", async () => {
    mockOrchestrator.inFlightEffectiveProviderByGroup.set("g1", {
      providerId: "openai",
      model: "gpt-4",
      providerConfig: dummyProviderConfig,
    });
    mockIsLlamafileResolutionError.mockReturnValue(false);
    mockIsTransformersJsResolutionError.mockReturnValue(false);
    mockDetectProviderHelpType.mockReturnValue("api_key_missing");

    await send({
      type: "error",
      payload: { groupId: "g1", error: "Invalid API key" },
    });

    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("provider-help", {
      providerId: "openai",
      reason: "Invalid API key",
      helpType: "api_key_missing",
    });
  });

  it("handles simple events and tool activities", async () => {
    await send({ type: "typing", payload: { groupId: "g1" } });
    expect(mockOrchestrator.router?.setTyping).toHaveBeenCalledWith("g1", true);

    // write_file done
    await send({
      type: "tool-activity",
      payload: { groupId: "g1", tool: "write_file", status: "done" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("file-change", {
      groupId: "g1",
    });

    // bash done
    await send({
      type: "tool-activity",
      payload: { groupId: "g1", tool: "bash", status: "done" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("file-change", {
      groupId: "g1",
    });

    // other tool / running status
    (mockOrchestrator.events.emit as jest.Mock).mockClear();
    await send({
      type: "tool-activity",
      payload: { groupId: "g1", tool: "read_file", status: "done" },
    });
    expect(mockOrchestrator.events.emit).not.toHaveBeenCalledWith(
      "file-change",
      expect.anything(),
    );

    await send({
      type: "compact-done",
      payload: { groupId: "g1", summary: "s" },
    });
    expect(mockOrchestrator.handleCompactDone).toHaveBeenCalledWith(
      mockDb,
      "g1",
      "s",
    );

    await send({ type: "clear-chat", payload: { groupId: "g1" } });
    expect(mockOrchestrator.newSession).toHaveBeenCalledWith(mockDb, "g1");

    // Clear chat throws
    (
      mockOrchestrator.newSession as jest.Mock<
        (...args: unknown[]) => Promise<unknown>
      >
    ).mockRejectedValueOnce(new Error("Clear error"));
    await send({ type: "clear-chat", payload: { groupId: "g1" } });

    await send({ type: "show-toast", payload: { message: "msg" } });
    expect(mockShowToast).toHaveBeenCalledWith("msg", {
      type: "info",
      duration: undefined,
    });

    await send({
      type: "model-download-progress",
      payload: { progress: 0.5 },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "model-download-progress",
      { progress: 0.5 },
    );

    await send({ type: "thinking-log", payload: { text: "thinking..." } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("thinking-log", {
      text: "thinking...",
    });

    await send({ type: "token-usage", payload: { tokens: 100 } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("token-usage", {
      tokens: 100,
    });
  });

  it("handles manage-tools with enable, disable, and default groupId", async () => {
    await send({
      type: "manage-tools",
      payload: { action: "activate_profile", profileId: "p1" },
    });
    expect(mockToolsStore.activateProfile).toHaveBeenCalledWith(mockDb, "p1");
    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          groupId: "br:main",
        }),
      }),
    );

    await send({
      type: "manage-tools",
      payload: { action: "enable", toolNames: ["t1"], groupId: "g1" },
    });
    expect(mockToolsStore.setToolEnabled).toHaveBeenCalledWith(
      mockDb,
      "t1",
      true,
    );

    await send({
      type: "manage-tools",
      payload: { action: "disable", toolNames: ["t2"] },
    });
    expect(mockToolsStore.setToolEnabled).toHaveBeenCalledWith(
      mockDb,
      "t2",
      false,
    );

    // Unrecognized action
    await send({
      type: "manage-tools",
      payload: { action: "unknown_action" },
    });
  });

  it("handles push notifications and recursion guard", async () => {
    mockOrchestrator.schedulerTriggeredGroups.add("g1");
    await send({
      type: "send-notification",
      payload: { title: "t", body: "b", groupId: "g1" },
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("Notification blocked"),
      expect.any(Object),
    );
    mockOrchestrator.schedulerTriggeredGroups.clear();

    await send({
      type: "send-notification",
      payload: { title: "t", body: "b" },
    });
    expect(mockGetPushUrl).toHaveBeenCalled();

    // Fetch error handling
    (
      global.fetch as jest.Mock<(...args: unknown[]) => Promise<unknown>>
    ).mockRejectedValueOnce(new Error("Push network error"));
    await send({
      type: "send-notification",
      payload: { title: "t", body: "b" },
    });
    await new Promise(process.nextTick);
  });

  it("handles send-file variations", async () => {
    await send({
      type: "send-file",
      payload: { groupId: "g1", path: "test.txt" },
    });
    await new Promise(process.nextTick);
    expect(mockOrchestrator.router?.send).toHaveBeenCalledWith("g1", "", [
      expect.objectContaining({ fileName: "test.txt" }),
    ]);

    // Empty path fallback
    await send({
      type: "send-file",
      payload: { groupId: "g1", path: "" },
    });
    await new Promise(process.nextTick);
    expect(mockOrchestrator.router?.send).toHaveBeenCalledWith("g1", "", [
      expect.objectContaining({ fileName: "" }),
    ]);

    // Rejection with non-Error
    (
      mockOrchestrator.router?.send as jest.Mock<
        (...args: unknown[]) => Promise<unknown>
      >
    ).mockRejectedValueOnce("raw string rejection");
    await send({
      type: "send-file",
      payload: { groupId: "g1", path: "fail.txt" },
    });
    await new Promise(process.nextTick);
    expect(mockShowToast).toHaveBeenCalledWith(
      "Failed to send file to peer: raw string rejection",
      expect.any(Object),
    );
  });

  it("handles send-file rejection with Error", async () => {
    (
      mockOrchestrator.router?.send as jest.Mock<
        (...args: unknown[]) => Promise<unknown>
      >
    ).mockRejectedValueOnce(new Error("Send failed"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await send({
      type: "send-file",
      payload: { groupId: "g2", path: "fail.txt" },
    });

    await new Promise(process.nextTick);

    expect(consoleError).toHaveBeenCalledWith(
      "send-file: delivery failed:",
      expect.any(Error),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send file"),
      expect.any(Object),
    );
    consoleError.mockRestore();
  });

  it("handles open-file", async () => {
    await send({ type: "open-file", payload: { path: "test.txt" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("open-file", {
      path: "test.txt",
    });
  });

  it("handles render-component", async () => {
    (mockOrchestrator.router?.findChannel as jest.Mock).mockReturnValue({
      sendA2UI: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    });
    mockRoomIdFromGroupId.mockReturnValue("r1");

    await send({
      type: "render-component",
      payload: { groupId: "peer:g1", envelope: {} },
    });
    await send({
      type: "render-component",
      payload: { groupId: "room:r1", envelope: {} },
    });

    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "a2ui-surface",
      expect.any(Object),
    );
    expect(mockOrchestrator.roomManager.broadcastA2UI).toHaveBeenCalled();

    // peer: group where channel does not implement sendA2UI
    (mockOrchestrator.router?.findChannel as jest.Mock).mockReturnValue({});
    await send({
      type: "render-component",
      payload: { groupId: "peer:g2", envelope: {} },
    });
  });

  it("handles render-component sendA2UI rejection", async () => {
    (mockOrchestrator.router?.findChannel as jest.Mock).mockReturnValue({
      sendA2UI: jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error("err")),
    });
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await send({
      type: "render-component",
      payload: { groupId: "peer:g1", envelope: {} },
    });

    await new Promise(process.nextTick);

    expect(consoleError).toHaveBeenCalledWith(
      "render-component: peer delivery failed:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("handles ask-user", async () => {
    await send({ type: "ask-user", payload: { question: "hi" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("ask-user", {
      question: "hi",
    });
  });

  it("handles vm events", async () => {
    await send({ type: "vm-status", payload: { status: "running" } });
    expect(mockOrchestrator.vmStatus).toEqual({ status: "running" });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("vm-status", {
      status: "running",
    });

    await send({ type: "vm-terminal-opened", payload: { termId: "1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-opened",
      { termId: "1" },
    );

    await send({ type: "vm-terminal-output", payload: { output: "hi" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-output",
      { output: "hi" },
    );

    await send({ type: "vm-terminal-closed", payload: { termId: "1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-closed",
      { termId: "1" },
    );

    await send({ type: "vm-workspace-synced", payload: { groupId: "g1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("file-change", {
      groupId: "g1",
    });

    await send({ type: "vm-terminal-error", payload: { error: "err" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-error",
      { error: "err" },
    );
  });

  it("handles mcp-reauth-required success, retry action, and popup success/failure", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      autoReconnectOAuth: true,
      label: "conn",
    });
    mockReconnectMcpOAuth.mockResolvedValue({ success: true });

    await send({
      type: "mcp-reauth-required",
      payload: { connectionId: "c1" },
    });

    expect(mockReconnectMcpOAuth).toHaveBeenCalled();
    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
      type: "mcp-reauth-result",
      payload: { connectionId: "c1", success: true },
    });

    // Reauth silent attempt fails -> triggers popup action
    mockGetRemoteMcpConnection.mockResolvedValue({
      autoReconnectOAuth: true,
    });
    mockReconnectMcpOAuth.mockResolvedValueOnce({
      success: false,
      error: "Token expired",
    });

    await send({
      type: "mcp-reauth-required",
      payload: { connectionId: "c2" },
    });

    const failedToastCall = mockShowToast.mock.calls[
      mockShowToast.mock.calls.length - 1
    ] as [string, { action?: { onClick?: () => Promise<void> } }];
    const onClick = failedToastCall[1]?.action?.onClick;
    expect(typeof onClick).toBe("function");

    // Click popup reconnect -> success
    mockReconnectMcpOAuth.mockResolvedValueOnce({ success: true });
    await onClick!();
    expect(mockShowToast).toHaveBeenCalledWith(
      '🔑 OAuth reconnected for "c2"',
      expect.objectContaining({ type: "success" }),
    );

    // Click popup reconnect -> failure
    mockReconnectMcpOAuth.mockResolvedValueOnce({
      success: false,
      error: "User cancelled",
    });
    await onClick!();
    expect(mockShowToast).toHaveBeenCalledWith(
      '🔑 OAuth reconnect failed for "c2": User cancelled',
      expect.objectContaining({ type: "error" }),
    );
  });

  it("handles mcp-reauth-required without auto-reconnect", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({ autoReconnectOAuth: false });

    await send({
      type: "mcp-reauth-required",
      payload: { connectionId: "c1" },
    });

    expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
      type: "mcp-reauth-result",
      payload: { connectionId: "c1", success: false },
    });
  });

  describe("request-native-ai-task", () => {
    it("handles local backend preference and resolves pendingNativeAiResolvers on globalThis", async () => {
      mockGetConfig.mockResolvedValue("local");
      mockTranslateText.mockResolvedValue("tres");

      const localResolve = jest.fn();
      const localReject = jest.fn();
      globalNativeAi.pendingNativeAiResolvers = {
        task_123: { resolve: localResolve, reject: localReject },
      };

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "task_123",
          groupId: "g1",
          taskType: "translate",
          input: {
            text: "three",
            sourceLanguage: "en",
            targetLanguage: "es",
          },
        },
      });

      await new Promise(process.nextTick);

      expect(mockTranslateText).toHaveBeenCalledWith(
        "three",
        expect.objectContaining({
          sourceLanguage: "en",
          targetLanguage: "es",
        }),
      );
      expect(localResolve).toHaveBeenCalledWith("tres");
      expect(
        globalNativeAi.pendingNativeAiResolvers?.["task_123"],
      ).toBeUndefined();
      expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
        type: "native-ai-task-response",
        payload: { id: "task_123", response: "tres" },
      });
    });

    it("handles onProgress callback and task execution without groupId", async () => {
      mockGetConfig.mockResolvedValue("local");
      mockSummarizeText.mockImplementation(
        async (_text: unknown, options: unknown) => {
          const opts = options as { onProgress?: (p: unknown) => void };
          opts.onProgress?.({
            status: "downloading",
            progress: 0.5,
            message: "downloading model",
          });
          return "summary result";
        },
      );
      mockGetApiKeyForRequest.mockResolvedValueOnce(null);

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "task_no_group",
          taskType: "summarize",
          input: { text: "text without group" },
        },
      });

      await new Promise(process.nextTick);

      expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
        type: "native-ai-task-response",
        payload: { id: "task_no_group", response: "summary result" },
      });
    });

    it("handles active_provider preference with Prompt API and resolves local resolvers", async () => {
      mockGetConfig.mockResolvedValue("active_provider");
      mockOrchestrator.provider = "prompt_api";

      const mockPrompt = jest.fn<(_p?: string) => Promise<string>>(
        async () => "tres",
      );
      const mockDestroy = jest.fn();
      const mockCreate = jest.fn<
        () => Promise<{
          prompt: typeof mockPrompt;
          destroy: typeof mockDestroy;
        }>
      >(async () => ({
        prompt: mockPrompt,
        destroy: mockDestroy,
      }));

      globalNativeAi.LanguageModel = { create: mockCreate };

      const localResolve = jest.fn();
      const localReject = jest.fn();
      globalNativeAi.pendingNativeAiResolvers = {
        task_456: { resolve: localResolve, reject: localReject },
      };

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "task_456",
          groupId: "g1",
          taskType: "translate",
          input: {
            text: "three",
            sourceLanguage: "en",
            targetLanguage: "es",
          },
        },
      });

      await new Promise(process.nextTick);

      expect(mockCreate).toHaveBeenCalled();
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.stringContaining("Translate the following text"),
      );
      expect(mockDestroy).toHaveBeenCalled();
      expect(localResolve).toHaveBeenCalledWith("tres");
      expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
        type: "native-ai-task-response",
        payload: { id: "task_456", response: "tres" },
      });

      delete globalNativeAi.LanguageModel;
    });

    it("rejects local resolvers and sends error message on failure with Error and non-Error", async () => {
      mockGetConfig.mockResolvedValue("local");
      mockSummarizeText.mockRejectedValue(
        new Error("Summarizer out of memory"),
      );

      const localResolve = jest.fn();
      const localReject = jest.fn();
      globalNativeAi.pendingNativeAiResolvers = {
        task_err: { resolve: localResolve, reject: localReject },
      };

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "task_err",
          groupId: "g1",
          taskType: "summarize",
          input: { text: "Long text" },
        },
      });

      await new Promise(process.nextTick);

      expect(localReject).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Summarizer out of memory" }),
      );
      expect(
        globalNativeAi.pendingNativeAiResolvers?.["task_err"],
      ).toBeUndefined();
      expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
        type: "native-ai-task-response",
        payload: { id: "task_err", error: "Summarizer out of memory" },
      });

      // Non-Error rejection without groupId
      mockSummarizeText.mockRejectedValueOnce("raw string failure");
      const stringResolve = jest.fn();
      const stringReject = jest.fn();
      globalNativeAi.pendingNativeAiResolvers = {
        task_string_err: { resolve: stringResolve, reject: stringReject },
      };

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "task_string_err",
          taskType: "summarize",
          input: { text: "Long text" },
        },
      });

      await new Promise(process.nextTick);

      expect(stringReject).toHaveBeenCalledWith(
        expect.objectContaining({ message: "raw string failure" }),
      );
      expect(mockOrchestrator.agentWorker?.postMessage).toHaveBeenCalledWith({
        type: "native-ai-task-response",
        payload: { id: "task_string_err", error: "raw string failure" },
      });

      // Non-Error rejection WITH groupId
      mockSummarizeText.mockRejectedValueOnce("raw string failure with group");
      const stringResolveGroup = jest.fn();
      const stringRejectGroup = jest.fn();
      globalNativeAi.pendingNativeAiResolvers = {
        task_string_group: {
          resolve: stringResolveGroup,
          reject: stringRejectGroup,
        },
      };

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "task_string_group",
          groupId: "g1",
          taskType: "summarize",
          input: { text: "Long text" },
        },
      });

      await new Promise(process.nextTick);

      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
        "model-download-progress",
        expect.objectContaining({
          groupId: "g1",
          status: "error",
          message: "raw string failure with group",
        }),
      );
    });
  });

  describe("request-native-ai-task uses inFlightEffectiveProviderByGroup.model", () => {
    it("passes the in-flight resolved model to formatRequest, not providerConfig.defaultModel", async () => {
      const { getProvider } = await import("../../../config/config.js");
      (getProvider as unknown as jest.Mock).mockReturnValue({
        name: "Test Provider",
        baseUrl: "https://api.test.example/v1",
        format: "openai",
        requiresApiKey: true,
        supportsStreaming: false,
        defaultModel: "provider-default-model",
      });

      mockGetConfig.mockResolvedValue("active_provider");
      mockOrchestrator.provider = "test-provider";
      mockOrchestrator.model = "orchestrator-fallback-model";

      const resolvedModel = "claude-sonnet-4-5-pinned";
      mockOrchestrator.inFlightEffectiveProviderByGroup.set("g1", {
        providerId: "test-provider",
        providerConfig: {
          ...dummyProviderConfig,
          name: "Test Provider",
          baseUrl: "https://api.test.example/v1",
          format: "openai",
          requiresApiKey: true,
          defaultModel: "provider-default-model",
        },
        model: resolvedModel,
      });

      global.fetch = jest
        .fn<(...args: unknown[]) => Promise<Response>>()
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: "Summarized." } }],
            }),
        } as unknown as Response);

      mockParseResponse.mockReturnValue({
        content: [{ type: "text", text: "Summarized." }],
      });

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "model-check-task",
          groupId: "g1",
          taskType: "summarize",
          input: { text: "A very long article…" },
        },
      });

      await new Promise(process.nextTick);

      expect(mockFormatRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ model: resolvedModel }),
      );
    });

    it("falls back to providerConfig.defaultModel when inFlightInfo.model is not set", async () => {
      mockGetConfig.mockResolvedValue("active_provider");
      mockOrchestrator.inFlightEffectiveProviderByGroup.set("g1", {
        providerId: "test-provider",
        providerConfig: {
          ...dummyProviderConfig,
          defaultModel: "provider-config-default-model",
        },
        model: "",
      });

      await send({
        type: "request-native-ai-task",
        payload: {
          id: "model-fallback-task",
          groupId: "g1",
          taskType: "summarize",
          input: { text: "A very long article…" },
        },
      });

      await new Promise(process.nextTick);

      expect(mockFormatRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ model: "provider-config-default-model" }),
      );
    });
  });

  it("safely ignores unrecognized worker message types", async () => {
    await send({ type: "unknown-type-xyz", payload: {} });
    expect(mockOrchestrator.events.emit).not.toHaveBeenCalled();
  });
});
