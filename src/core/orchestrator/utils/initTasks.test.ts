import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_PROMPT_API_FALLBACK_MODEL,
  DEFAULT_TASK_SERVER_URL,
  getDefaultProvider,
  getModelMaxTokens,
} from "../../../config/config.js";
import type { ProviderConfig } from "../../../config/config.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Task } from "../../../db/types.js";
import type { RoomInvitePayload } from "../../../subsystems/channels/peer-protocol.js";
import type {
  InboundMessage,
  RoomMember,
  RoomMeta,
} from "../../../subsystems/channels/types.js";
import type { Orchestrator } from "../orchestrator.js";

const mockEnqueue = jest
  .fn<
    (
      o: Orchestrator,
      db: ShadowClawDatabase,
      msg: InboundMessage,
    ) => Promise<void>
  >()
  .mockResolvedValue(undefined);

jest.unstable_mockModule("./enqueue.js", () => ({
  enqueue: mockEnqueue,
}));

const mockApplyAllChannelRunningStates =
  jest.fn<(state: Orchestrator) => void>();
jest.unstable_mockModule("./operations/channel.js", () => ({
  applyAllChannelRunningStates: mockApplyAllChannelRunningStates,
  applyChannelRunningState: jest.fn(),
  clearPeerJsTypingState: jest.fn(),
  getChannelByType: jest.fn(),
  getChannelEnabled: jest.fn(),
  getChannelEnabledConfigKey: jest.fn(),
  getChannelTypeForGroup: jest.fn(),
  loadChannelEnabled: jest.fn(),
  setChannelEnabled: jest.fn(),
  shouldRunChannel: jest.fn(),
  submitMessage: jest.fn(),
}));

const mockRunTaskAsScheduled = jest
  .fn<(state: Orchestrator, task: Task) => Promise<void>>()
  .mockResolvedValue(undefined);
const mockShouldStartLocalScheduler = jest
  .fn<() => Promise<boolean>>()
  .mockResolvedValue(true);
jest.unstable_mockModule("./operations/task.js", () => ({
  deleteTaskFromServer: jest.fn(),
  runTaskAsScheduled: mockRunTaskAsScheduled,
  shouldStartLocalScheduler: mockShouldStartLocalScheduler,
  syncTaskToServer: jest.fn(),
  warnIfNoPushSubscription: jest.fn(),
}));

const mockDeleteRoom = jest
  .fn<(db: ShadowClawDatabase, id: string) => Promise<void>>()
  .mockResolvedValue(undefined);
const mockFetchModelInfo = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
const mockGetConfig =
  jest.fn<
    (db: ShadowClawDatabase, key: string) => Promise<string | undefined>
  >();
const mockGetRoomMetadata = jest
  .fn<(db: ShadowClawDatabase) => Promise<RoomMeta[]>>()
  .mockResolvedValue([]);
const mockRoomManagerLoadRooms = jest.fn<(rooms: RoomMeta[]) => void>();
const mockRoomManagerInstance = {
  loadRooms: mockRoomManagerLoadRooms,
  createRoom: jest.fn(),
  invite: jest.fn(),
  joinRoom: jest.fn(),
  leaveRoom: jest.fn(),
  list: jest.fn(),
};
let capturedRoomManagerConfig: {
  transport: {
    myPeerId: string;
    sendToPeer: (peerId: string, note: unknown) => void;
    isConnected: (peerId: string) => boolean;
    connectToPeer: (peerId: string) => void;
  };
  getLocalMember: () => RoomMember;
  onMessage: (msg: InboundMessage) => void;
  onInvite: (invite: RoomInvitePayload) => void;
  persistRoom: (room: RoomMeta) => void;
  removeRoom: (roomId: string) => void;
} | null = null;

const mockRoomManager = jest
  .fn<
    (config: typeof capturedRoomManagerConfig) => typeof mockRoomManagerInstance
  >()
  .mockImplementation((config) => {
    capturedRoomManagerConfig = config;
    return mockRoomManagerInstance;
  });

const mockSetConfig = jest
  .fn<(db: ShadowClawDatabase, key: string, value: string) => Promise<void>>()
  .mockResolvedValue(undefined);
const mockSetRemoteAgentTyping =
  jest.fn<(groupId: string, typing: boolean) => void>();
const mockSetWebMcpMode = jest.fn<(mode: string) => void>();
const mockTaskSchedulerStart = jest.fn<() => void>();
let capturedTaskExecutor: ((task: Task) => Promise<void>) | null = null;
let capturedTaskOnExecuted: (() => void) | null = null;

const mockTaskScheduler = jest
  .fn<
    (
      executor: (task: Task) => Promise<void>,
      onExecuted: () => void,
    ) => { start: () => void; stop: () => void }
  >()
  .mockImplementation((executor, onExecuted) => {
    capturedTaskExecutor = executor;
    capturedTaskOnExecuted = onExecuted;
    return {
      start: mockTaskSchedulerStart,
      stop: jest.fn(),
    };
  });

const mockToTrustedScriptUrl = jest
  .fn<(url: string) => string>()
  .mockImplementation((url: string) => url);
const mockUpsertRoom = jest
  .fn<(db: ShadowClawDatabase, room: RoomMeta) => Promise<void>>()
  .mockResolvedValue(undefined);
const mockHandleRoomInvite =
  jest.fn<(state: unknown, invite: RoomInvitePayload) => void>();

const mockApplyLlamafileHeaders = jest.fn<(o: Orchestrator) => void>();
const mockApplyMeshLlmHeaders = jest.fn<(o: Orchestrator) => void>();
const mockGetApiKeyForHeaders = jest
  .fn<(o: Orchestrator) => Promise<string | null>>()
  .mockResolvedValue("key");
const mockGetProviderRuntimeHeaders = jest
  .fn<(o: Orchestrator, prov: string) => Record<string, string>>()
  .mockReturnValue({});

jest.unstable_mockModule("./operations/provider.js", () => ({
  applyLlamafileHeaders: mockApplyLlamafileHeaders,
  applyMeshLlmHeaders: mockApplyMeshLlmHeaders,
  getApiKeyForHeaders: mockGetApiKeyForHeaders,
  getProviderRuntimeHeaders: mockGetProviderRuntimeHeaders,
}));

jest.unstable_mockModule("./operations/room.js", () => ({
  handleRoomInvite: mockHandleRoomInvite,
}));

const mockIsPromptApiSupported = jest
  .fn<() => boolean>()
  .mockReturnValue(false);
jest.unstable_mockModule(
  "../../../subsystems/providers/prompt-api-provider.js",
  () => ({
    isPromptApiSupported: mockIsPromptApiSupported,
  }),
);

const mockFetchTokenizerConfig = jest
  .fn<(model: string) => Promise<unknown>>()
  .mockResolvedValue({});
jest.unstable_mockModule(
  "../../../subsystems/providers/utils/chatTemplate.js",
  () => ({
    fetchTokenizerConfig: mockFetchTokenizerConfig,
  }),
);

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("../../../db/rooms.js", () => ({
  ROOM_PREFIX: "room:",
  getRoomMetadata: mockGetRoomMetadata,
  upsertRoom: mockUpsertRoom,
  deleteRoom: mockDeleteRoom,
  roomIdFromGroupId: jest.fn((id: string) => id.replace("room:", "")),
  isRoomGroupId: jest.fn((id: string) => id.startsWith("room:")),
}));

jest.unstable_mockModule(
  "../../../subsystems/providers/model-registry.js",
  () => ({
    modelRegistry: {
      fetchModelInfo: mockFetchModelInfo,
    },
  }),
);

jest.unstable_mockModule("../../../subsystems/tools/task-scheduler.js", () => ({
  TaskScheduler: mockTaskScheduler,
}));

jest.unstable_mockModule(
  "../../../subsystems/channels/room-manager.js",
  () => ({
    RoomManager: mockRoomManager,
  }),
);

jest.unstable_mockModule("../../../subsystems/mcp/webmcp.js", () => ({
  setWebMcpMode: mockSetWebMcpMode,
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    setRemoteAgentTyping: mockSetRemoteAgentTyping,
  },
}));

jest.unstable_mockModule("../../../security/trusted-types.js", () => ({
  toTrustedScriptUrl: mockToTrustedScriptUrl,
}));

const mockSyncProxyConfigToServiceWorker =
  jest.fn<(state: Orchestrator) => void>();
jest.unstable_mockModule("./syncProxyConfigToServiceWorker.js", () => ({
  syncProxyConfigToServiceWorker: mockSyncProxyConfigToServiceWorker,
}));

const mockLoadChannelConfigurations = jest
  .fn<(state: Orchestrator, db: ShadowClawDatabase) => Promise<void>>()
  .mockResolvedValue(undefined);
jest.unstable_mockModule("./loadChannelConfigurations.js", () => ({
  loadChannelConfigurations: mockLoadChannelConfigurations,
}));

const mockSetupPushTaskListener =
  jest.fn<(orchestrator: Orchestrator, db: ShadowClawDatabase) => void>();
jest.unstable_mockModule("./setupPushTaskListener.js", () => ({
  setupPushTaskListener: mockSetupPushTaskListener,
}));

const mockHandleWorkerMessage =
  jest.fn<
    (orchestrator: Orchestrator, db: ShadowClawDatabase, msg: unknown) => void
  >();
jest.unstable_mockModule("./handleWorkerMessage.js", () => ({
  handleWorkerMessage: mockHandleWorkerMessage,
}));

const {
  createRoomManager,
  initChannelsAndRooms,
  initCoreConfig,
  initFeatureFlagsAndLimits,
  initLlamafileAndMesh,
  initProviderAndModel,
  initWorkerAndScheduler,
} = await import("./initTasks.js");

class MockWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  postMessage = jest.fn<(_data: unknown) => void>();
  constructor(
    public scriptURL: string | URL,
    public options?: WorkerOptions,
  ) {}
}

interface MockPeerJs {
  myPeerId: string;
  sendRoomNotification: jest.Mock<(_peerId: string, _note: unknown) => void>;
  isPeerConnected: jest.Mock<(_peerId: string) => boolean>;
  connectPeer: jest.Mock<(_peerId: string) => void>;
  onTaskComplete: jest.Mock<(_cb: (_groupId: string) => void) => void>;
}

interface MockChannelRegistry {
  onMessage: jest.Mock<(_cb: (_msg: InboundMessage) => void) => void>;
  onTyping: jest.Mock<
    (_cb: (_groupId: string, _typing: boolean) => void) => void
  >;
}

interface MockInitOrchestrator {
  peerjs: MockPeerJs;
  peerjsMyPeerId: string;
  peerjsMyAlias: string;
  assistantName: string;
  roomChannel: { deliverInbound: jest.Mock<(_msg: InboundMessage) => void> };
  handleRoomInvite: jest.Mock;
  db: ShadowClawDatabase | null;
  channelRegistry: MockChannelRegistry;
  events: { emit: jest.Mock<(_event: string, _payload: unknown) => void> };
  peerCompletedContexts: Set<string>;
  roomManager: { loadRooms: jest.Mock<(_rooms: RoomMeta[]) => void> };
  initializeChannelRegistry: jest.Mock<() => void>;
  applyLlamafileHeaders: jest.Mock<() => void>;
  applyMeshLlmHeaders: jest.Mock<() => void>;
  getApiKeyForHeaders: jest.Mock<() => Promise<string | null>>;
  getApiKey: jest.Mock<() => Promise<string | null>>;
  getProviderRuntimeHeaders: jest.Mock<() => Record<string, string>>;
  loadApiKeyForProvider: jest.Mock<
    (_db: ShadowClawDatabase, _provider: string) => Promise<void>
  >;
  runTaskAsScheduled: jest.Mock;
  shouldStartLocalScheduler: jest.Mock;
  setupPushTaskListener: jest.Mock;
  handleWorkerMessage: jest.Mock;
  provider: string;
  providerConfig: ProviderConfig;
  model: string;
  maxTokens: number;
  maxIterations: number;
  rateLimitCallsPerMinute: number;
  rateLimitAutoAdapt: boolean;
  bedrockRegionFallback: string;
  bedrockProfileFallback: string;
  bedrockAuthMode: string;
  agentWorker?: MockWorker;
  scheduler?: { start: jest.Mock<() => void>; stop: jest.Mock<() => void> };
  vmBootMode?: string;
  streamingEnabled?: boolean;
  webMcpToolsEnabled?: boolean;
  vmBashFullInternetAccess?: boolean;
  contextCompressionEnabled?: boolean;
  reasoningEffort?: string;
  directToolCommandPolicy?: unknown;
  useProxy?: boolean;
  proxyUrl?: string;
  gitProxyUrl?: string;
  taskServerEnabled?: boolean;
  taskServerUrl?: string;
  llamafileMode?: string;
  llamafileHost?: string;
  llamafilePort?: number;
  llamafileOffline?: boolean;
  meshLlmHost?: string;
  triggerPattern?: RegExp;
}

describe("initTasks", () => {
  let mockOrchestrator: MockInitOrchestrator;
  const mockDb = {} as ShadowClawDatabase;
  const originalWorker = global.Worker;
  const originalRequestIdleCallback = (
    globalThis as unknown as { requestIdleCallback?: unknown }
  ).requestIdleCallback;

  beforeAll(() => {
    (globalThis as unknown as { Worker: unknown }).Worker = MockWorker;
    (
      globalThis as unknown as { requestIdleCallback: unknown }
    ).requestIdleCallback = (cb: () => void) => cb();
  });

  afterAll(() => {
    (globalThis as unknown as { Worker: unknown }).Worker = originalWorker;
    (
      globalThis as unknown as { requestIdleCallback: unknown }
    ).requestIdleCallback = originalRequestIdleCallback;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    capturedRoomManagerConfig = null;
    capturedTaskExecutor = null;
    capturedTaskOnExecuted = null;

    mockOrchestrator = {
      peerjs: {
        myPeerId: "peer1",
        sendRoomNotification: jest.fn(),
        isPeerConnected: jest
          .fn<(_peerId: string) => boolean>()
          .mockReturnValue(true),
        connectPeer: jest.fn(),
        onTaskComplete: jest.fn(),
      },
      peerjsMyPeerId: "peer1",
      peerjsMyAlias: "my-alias",
      assistantName: "Assistant",
      roomChannel: { deliverInbound: jest.fn() },
      handleRoomInvite: jest.fn(),
      db: mockDb,
      channelRegistry: {
        onMessage: jest.fn(),
        onTyping: jest.fn(),
      },
      events: { emit: jest.fn() },
      peerCompletedContexts: new Set<string>(),
      roomManager: { loadRooms: mockRoomManagerLoadRooms },
      initializeChannelRegistry: jest.fn(),
      applyLlamafileHeaders: jest.fn(),
      applyMeshLlmHeaders: jest.fn(),
      getApiKeyForHeaders: jest
        .fn<() => Promise<string | null>>()
        .mockResolvedValue("key"),
      getApiKey: jest
        .fn<() => Promise<string | null>>()
        .mockResolvedValue("key"),
      getProviderRuntimeHeaders: jest
        .fn<() => Record<string, string>>()
        .mockReturnValue({}),
      loadApiKeyForProvider: jest
        .fn<(_db: ShadowClawDatabase, _provider: string) => Promise<void>>()
        .mockResolvedValue(undefined),
      runTaskAsScheduled: jest.fn(),
      shouldStartLocalScheduler: jest.fn(),
      setupPushTaskListener: jest.fn(),
      handleWorkerMessage: jest.fn(),
      provider: "openrouter",
      providerConfig: getDefaultProvider(),
      model: "test-model",
      maxTokens: 4096,
      maxIterations: DEFAULT_MAX_ITERATIONS,
      rateLimitCallsPerMinute: 0,
      rateLimitAutoAdapt: true,
      bedrockRegionFallback: "",
      bedrockProfileFallback: "",
      bedrockAuthMode: "provider_chain",
    };

    mockGetConfig.mockResolvedValue(undefined);
  });

  describe("createRoomManager", () => {
    it("should create room manager with transport methods and local member", () => {
      createRoomManager(mockOrchestrator as unknown as Orchestrator);
      expect(mockRoomManager).toHaveBeenCalled();
      expect(capturedRoomManagerConfig).not.toBeNull();

      const config = capturedRoomManagerConfig!;
      expect(config.transport.myPeerId).toBe("peer1");

      config.transport.sendToPeer("peer2", { type: "test" });
      expect(mockOrchestrator.peerjs.sendRoomNotification).toHaveBeenCalledWith(
        "peer2",
        { type: "test" },
      );

      expect(config.transport.isConnected("peer2")).toBe(true);
      expect(mockOrchestrator.peerjs.isPeerConnected).toHaveBeenCalledWith(
        "peer2",
      );

      config.transport.connectToPeer("peer2");
      expect(mockOrchestrator.peerjs.connectPeer).toHaveBeenCalledWith("peer2");

      const member = config.getLocalMember();
      expect(member).toEqual({
        peerId: "peer1",
        alias: "my-alias",
        kind: "agent",
        agentName: "Assistant",
      });

      const inboundMsg: InboundMessage = {
        id: "msg-1",
        groupId: "room:r1",
        sender: "peer2",
        content: "hello",
        timestamp: Date.now(),
        channel: "room",
      };
      config.onMessage(inboundMsg);
      expect(mockOrchestrator.roomChannel.deliverInbound).toHaveBeenCalledWith(
        inboundMsg,
      );

      const invitePayload: RoomInvitePayload = {
        roomId: "r1",
        roomName: "Dev Room",
        hostPeerId: "peer1",
        fromPeerId: "peer1",
      };
      config.onInvite(invitePayload);
      expect(mockHandleRoomInvite).toHaveBeenCalledWith(
        mockOrchestrator,
        invitePayload,
      );
    });

    it("should test getLocalMember fallback branches and transport fallback myPeerId", () => {
      mockOrchestrator.peerjs.myPeerId = "";
      mockOrchestrator.peerjsMyPeerId = "fallback-peer-id";
      mockOrchestrator.peerjsMyAlias = "";

      createRoomManager(mockOrchestrator as unknown as Orchestrator);
      const config = capturedRoomManagerConfig!;

      expect(config.transport.myPeerId).toBe("fallback-peer-id");

      const memberWithPeerIdAlias = config.getLocalMember();
      expect(memberWithPeerIdAlias.alias).toBe("fallback-peer-id");

      mockOrchestrator.peerjsMyPeerId = "";
      const memberWithAssistantNameAlias = config.getLocalMember();
      expect(memberWithAssistantNameAlias.alias).toBe("Assistant");
    });

    it("should handle persistRoom and removeRoom with success, null db, and catch errors", async () => {
      createRoomManager(mockOrchestrator as unknown as Orchestrator);
      const config = capturedRoomManagerConfig!;
      const room: RoomMeta = {
        roomId: "r1",
        name: "Test Room",
        hostPeerId: "peer1",
        createdAt: Date.now(),
        members: [],
      };

      config.persistRoom(room);
      expect(mockUpsertRoom).toHaveBeenCalledWith(mockDb, room);

      config.removeRoom("r1");
      expect(mockDeleteRoom).toHaveBeenCalledWith(mockDb, "r1");

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockUpsertRoom.mockRejectedValueOnce(new Error("Persist fail"));
      config.persistRoom(room);
      await Promise.resolve();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to persist room:",
        expect.any(Error),
      );

      mockDeleteRoom.mockRejectedValueOnce(new Error("Delete fail"));
      config.removeRoom("r1");
      await Promise.resolve();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to delete room:",
        expect.any(Error),
      );

      mockOrchestrator.db = null;
      mockUpsertRoom.mockClear();
      mockDeleteRoom.mockClear();
      config.persistRoom(room);
      config.removeRoom("r1");
      expect(mockUpsertRoom).not.toHaveBeenCalled();
      expect(mockDeleteRoom).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("initChannelsAndRooms", () => {
    it("should initialize channel registry, callbacks, configurations, and rooms", async () => {
      const room1: RoomMeta = {
        roomId: "room1",
        name: "Room 1",
        hostPeerId: "peer1",
        createdAt: Date.now(),
        members: [],
      };
      mockGetRoomMetadata.mockResolvedValueOnce([room1]);

      await initChannelsAndRooms(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );

      expect(mockOrchestrator.initializeChannelRegistry).toHaveBeenCalled();
      expect(mockLoadChannelConfigurations).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockApplyAllChannelRunningStates).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
      );
      expect(mockRoomManagerLoadRooms).toHaveBeenCalledWith([room1]);

      // onMessage callback
      const onMessageCb =
        mockOrchestrator.channelRegistry.onMessage.mock.calls[0][0];
      const testMsg: InboundMessage = {
        id: "msg1",
        groupId: "g1",
        sender: "user",
        content: "hi",
        timestamp: Date.now(),
        channel: "browser",
      };
      onMessageCb(testMsg);
      expect(mockEnqueue).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
        testMsg,
      );

      // onTyping callback for peer and non-peer groups
      const onTypingCb =
        mockOrchestrator.channelRegistry.onTyping.mock.calls[0][0];
      onTypingCb("peer:p1", true);
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("typing", {
        groupId: "peer:p1",
        typing: true,
      });
      expect(mockSetRemoteAgentTyping).toHaveBeenCalledWith("peer:p1", true);

      mockSetRemoteAgentTyping.mockClear();
      onTypingCb("browser-group", false);
      expect(mockSetRemoteAgentTyping).not.toHaveBeenCalled();

      // onTaskComplete callback
      const onTaskCompleteCb =
        mockOrchestrator.peerjs.onTaskComplete.mock.calls[0][0];
      onTaskCompleteCb("peer:completed-group");
      expect(
        mockOrchestrator.peerCompletedContexts.has("peer:completed-group"),
      ).toBe(true);
    });

    it("should handle error in onMessage enqueue and error in getRoomMetadata", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockGetRoomMetadata.mockRejectedValueOnce(new Error("DB read error"));
      await initChannelsAndRooms(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to load rooms:",
        expect.any(Error),
      );

      mockEnqueue.mockRejectedValueOnce(new Error("Enqueue reject"));
      const onMessageCb =
        mockOrchestrator.channelRegistry.onMessage.mock.calls[0][0];
      onMessageCb({ id: "m" } as unknown as InboundMessage);
      await Promise.resolve();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to enqueue inbound message:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("initCoreConfig", () => {
    it("should load assistant name from config or default", async () => {
      mockGetConfig.mockResolvedValueOnce("CustomBot");
      await initCoreConfig(mockOrchestrator as unknown as Orchestrator, mockDb);
      expect(mockOrchestrator.assistantName).toBe("CustomBot");
      expect(mockOrchestrator.triggerPattern).toBeDefined();

      mockGetConfig.mockResolvedValueOnce(undefined);
      await initCoreConfig(mockOrchestrator as unknown as Orchestrator, mockDb);
      expect(mockOrchestrator.assistantName).toBe(ASSISTANT_NAME);
    });
  });

  describe("initFeatureFlagsAndLimits", () => {
    it("should load all feature flags, modes, and limits", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        switch (key) {
          case CONFIG_KEYS.VM_BOOT_MODE:
            return "9p";
          case CONFIG_KEYS.STREAMING_ENABLED:
            return "false";
          case CONFIG_KEYS.WEBMCP_TOOLS_ENABLED:
            return "false";
          case CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS:
            return "true";
          case CONFIG_KEYS.WEBMCP_MODE:
            return "polyfill";
          case CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED:
            return "true";
          case CONFIG_KEYS.REASONING_EFFORT:
            return "  Medium  ";
          case CONFIG_KEYS.USE_PROXY:
            return "true";
          case CONFIG_KEYS.PROXY_URL:
            return "http://proxy.local";
          case CONFIG_KEYS.GIT_PROXY_URL:
            return "http://git-proxy.local";
          case CONFIG_KEYS.TASK_SERVER_ENABLED:
            return "true";
          case CONFIG_KEYS.TASK_SERVER_URL:
            return "http://tasks.local";
          default:
            return undefined;
        }
      });

      await initFeatureFlagsAndLimits(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );

      expect(mockOrchestrator.vmBootMode).toBe("9p");
      expect(mockOrchestrator.streamingEnabled).toBe(false);
      expect(mockOrchestrator.webMcpToolsEnabled).toBe(false);
      expect(mockOrchestrator.vmBashFullInternetAccess).toBe(true);
      expect(mockSetWebMcpMode).toHaveBeenCalledWith("polyfill");
      expect(mockOrchestrator.contextCompressionEnabled).toBe(true);
      expect(mockOrchestrator.reasoningEffort).toBe("medium");
      expect(mockOrchestrator.useProxy).toBe(true);
      expect(mockOrchestrator.proxyUrl).toBe("http://proxy.local");
      expect(mockOrchestrator.gitProxyUrl).toBe("http://git-proxy.local");
      expect(mockOrchestrator.taskServerEnabled).toBe(true);
      expect(mockOrchestrator.taskServerUrl).toBe("http://tasks.local");
    });

    it("should handle default/fallback values for feature flags", async () => {
      mockGetConfig.mockResolvedValue(undefined);

      await initFeatureFlagsAndLimits(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );

      expect(mockOrchestrator.vmBootMode).toBe("disabled");
      expect(mockOrchestrator.streamingEnabled).toBe(true);
      expect(mockOrchestrator.webMcpToolsEnabled).toBe(true);
      expect(mockOrchestrator.vmBashFullInternetAccess).toBe(false);
      expect(mockOrchestrator.contextCompressionEnabled).toBe(false);
      expect(mockOrchestrator.reasoningEffort).toBe("none");
      expect(mockOrchestrator.useProxy).toBe(false);
      expect(mockOrchestrator.proxyUrl).toBe("/proxy");
      expect(mockOrchestrator.gitProxyUrl).toBe("/git-proxy");
      expect(mockOrchestrator.taskServerEnabled).toBe(false);
      expect(mockOrchestrator.taskServerUrl).toBe(DEFAULT_TASK_SERVER_URL);
    });

    it("should handle vmBootMode values auto, ext2, disabled, and invalid", async () => {
      for (const mode of ["auto", "ext2", "disabled"]) {
        mockGetConfig.mockResolvedValueOnce(mode);
        await initFeatureFlagsAndLimits(
          mockOrchestrator as unknown as Orchestrator,
          mockDb,
        );
        expect(mockOrchestrator.vmBootMode).toBe(mode);
      }

      mockGetConfig.mockResolvedValueOnce("invalid-mode");
      await initFeatureFlagsAndLimits(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockOrchestrator.vmBootMode).toBe("disabled");
    });
  });

  describe("initLlamafileAndMesh", () => {
    it("should load llamafile server mode, host, port, and offline flag", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        switch (key) {
          case CONFIG_KEYS.LLAMAFILE_MODE:
            return "server";
          case CONFIG_KEYS.LLAMAFILE_HOST:
            return "http://llama.local";
          case CONFIG_KEYS.LLAMAFILE_PORT:
            return "8088";
          case CONFIG_KEYS.LLAMAFILE_OFFLINE:
            return "false";
          case CONFIG_KEYS.MESH_LLM_HOST:
            return "http://mesh.local";
          default:
            return undefined;
        }
      });

      await initLlamafileAndMesh(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );

      expect(mockOrchestrator.llamafileMode).toBe("server");
      expect(mockOrchestrator.llamafileHost).toBe("http://llama.local");
      expect(mockOrchestrator.llamafilePort).toBe(8088);
      expect(mockOrchestrator.llamafileOffline).toBe(false);
      expect(mockOrchestrator.meshLlmHost).toBe("http://mesh.local");
      expect(mockApplyLlamafileHeaders).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
      );
      expect(mockApplyMeshLlmHeaders).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
      );
    });

    it("should persist default llamafileMode when stored mode is invalid or null", async () => {
      mockOrchestrator.llamafileMode = "cli";
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.LLAMAFILE_PORT) return "999999"; // out of bounds
        return undefined;
      });

      await initLlamafileAndMesh(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );

      expect(mockSetConfig).toHaveBeenCalledWith(
        mockDb,
        CONFIG_KEYS.LLAMAFILE_MODE,
        "cli",
      );
      expect(mockOrchestrator.llamafilePort).toBeUndefined();
    });

    it("should handle missing llamafile port", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.LLAMAFILE_PORT) return undefined;
        return undefined;
      });

      await initLlamafileAndMesh(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockOrchestrator.llamafilePort).toBeUndefined();
    });
  });

  describe("initProviderAndModel", () => {
    it("should configure provider and model and schedule model info fetch", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        switch (key) {
          case CONFIG_KEYS.PROVIDER:
            return "openrouter";
          case CONFIG_KEYS.MODEL:
            return "openai/gpt-4o";
          case CONFIG_KEYS.MAX_TOKENS:
            return "2048";
          case CONFIG_KEYS.MAX_ITERATIONS:
            return "15";
          case CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE:
            return "30";
          case CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT:
            return "false";
          case CONFIG_KEYS.BEDROCK_REGION_FALLBACK:
            return "us-east-1";
          case CONFIG_KEYS.BEDROCK_PROFILE_FALLBACK:
            return "my-profile";
          case CONFIG_KEYS.BEDROCK_AUTH_MODE:
            return "bearer";
          default:
            return undefined;
        }
      });

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      await Promise.resolve();

      expect(mockOrchestrator.provider).toBe("openrouter");
      expect(mockOrchestrator.model).toBe("openai/gpt-4o");
      expect(mockOrchestrator.maxTokens).toBe(2048);
      expect(mockOrchestrator.maxIterations).toBe(15);
      expect(mockOrchestrator.rateLimitCallsPerMinute).toBe(30);
      expect(mockOrchestrator.rateLimitAutoAdapt).toBe(false);
      expect(mockOrchestrator.bedrockRegionFallback).toBe("us-east-1");
      expect(mockOrchestrator.bedrockProfileFallback).toBe("my-profile");
      expect(mockOrchestrator.bedrockAuthMode).toBe("bearer");
      expect(mockFetchModelInfo).toHaveBeenCalled();
    });

    it("should handle prompt_api fallback model and token limits", async () => {
      mockIsPromptApiSupported.mockReturnValue(false);
      mockOrchestrator.provider = "prompt_api";
      mockOrchestrator.model = "browser-built-in";

      mockGetConfig.mockImplementation(async (_db, key) => {
        switch (key) {
          case CONFIG_KEYS.PROVIDER:
            return "prompt_api";
          case CONFIG_KEYS.MODEL:
            return "browser-built-in";
          case CONFIG_KEYS.MAX_TOKENS:
            return "4096";
          case CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL:
            return "fallback-model-x";
          default:
            return undefined;
        }
      });

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );

      expect(mockFetchTokenizerConfig).toHaveBeenCalledWith("fallback-model-x");
      expect(mockOrchestrator.maxTokens).toBeGreaterThan(0);
    });

    it("should handle empty model, rejected tokenizer fetch, invalid iterations and rate limits", async () => {
      mockIsPromptApiSupported.mockReturnValue(false);
      mockFetchTokenizerConfig.mockRejectedValueOnce(
        new Error("tokenizer fetch failed"),
      );
      mockGetApiKeyForHeaders.mockResolvedValueOnce(null);
      mockOrchestrator.provider = "prompt_api";
      mockOrchestrator.model = "";

      mockGetConfig.mockImplementation(async (_db, key) => {
        switch (key) {
          case CONFIG_KEYS.PROVIDER:
            return undefined;
          case CONFIG_KEYS.MAX_ITERATIONS:
            return "not-a-number";
          case CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE:
            return "not-a-number";
          case CONFIG_KEYS.PROMPT_API_FALLBACK_MODEL:
            return undefined;
          default:
            return undefined;
        }
      });

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      await Promise.resolve();

      expect(mockOrchestrator.maxIterations).toBe(DEFAULT_MAX_ITERATIONS);
      expect(mockOrchestrator.rateLimitCallsPerMinute).toBe(0);
      expect(mockFetchTokenizerConfig).toHaveBeenCalledWith(
        DEFAULT_PROMPT_API_FALLBACK_MODEL,
      );
    });

    it("should keep model unchanged when prompt_api is supported", async () => {
      mockIsPromptApiSupported.mockReturnValueOnce(true);
      mockOrchestrator.provider = "prompt_api";
      mockOrchestrator.model = "browser-built-in";
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.PROVIDER) return "prompt_api";
        if (key === CONFIG_KEYS.MODEL) return "browser-built-in";
        return undefined;
      });

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockOrchestrator.model).toBe("browser-built-in");
    });

    it("should keep custom model when prompt_api is not supported but model is custom", async () => {
      mockIsPromptApiSupported.mockReturnValueOnce(false);
      mockOrchestrator.provider = "prompt_api";
      mockOrchestrator.model = "custom-model";
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.PROVIDER) return "prompt_api";
        if (key === CONFIG_KEYS.MODEL) return "custom-model";
        return undefined;
      });

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockOrchestrator.model).toBe("custom-model");
    });

    it("should reset legacy 8192 maxTokens to dynamic max tokens", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.MAX_TOKENS) return "8192";
        return undefined;
      });

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockOrchestrator.maxTokens).toBe(
        getModelMaxTokens(mockOrchestrator.model),
      );
    });

    it("should handle non-idleCallback environment and DOM load listener", async () => {
      const origIdle = (
        globalThis as unknown as { requestIdleCallback?: unknown }
      ).requestIdleCallback;
      delete (globalThis as unknown as { requestIdleCallback?: unknown })
        .requestIdleCallback;

      const addEventListenerSpy = jest.spyOn(
        window as unknown as {
          addEventListener: (
            type: string,
            listener: () => void,
            options?: unknown,
          ) => void;
        },
        "addEventListener",
      );
      const originalReadyState = document.readyState;
      Object.defineProperty(document, "readyState", {
        value: "loading",
        configurable: true,
      });

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "load",
        expect.any(Function),
        { once: true },
      );
      const loadCall = addEventListenerSpy.mock.calls.find(
        (call) => (call[0] as string) === "load",
      );
      const loadHandler = loadCall?.[1] as (() => void) | undefined;
      loadHandler?.();

      Object.defineProperty(document, "readyState", {
        value: originalReadyState,
        configurable: true,
      });
      addEventListenerSpy.mockRestore();
      if (origIdle !== undefined) {
        (
          globalThis as unknown as { requestIdleCallback: unknown }
        ).requestIdleCallback = origIdle;
      }
    });

    it("should use requestIdleCallback when available", async () => {
      const origIdle = (
        globalThis as unknown as { requestIdleCallback?: unknown }
      ).requestIdleCallback;
      const mockIdle = jest.fn((cb: () => void) => {
        cb();
        return 1;
      });
      (
        globalThis as unknown as { requestIdleCallback: unknown }
      ).requestIdleCallback = mockIdle;

      await initProviderAndModel(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockIdle).toHaveBeenCalled();

      if (origIdle !== undefined) {
        (
          globalThis as unknown as { requestIdleCallback: unknown }
        ).requestIdleCallback = origIdle;
      } else {
        delete (globalThis as unknown as { requestIdleCallback?: unknown })
          .requestIdleCallback;
      }
    });
  });

  describe("initWorkerAndScheduler", () => {
    it("should spawn worker, handle messages, errors, storage handle, and scheduler callbacks", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.STORAGE_HANDLE) return "store-handle-xyz";
        return undefined;
      });
      mockShouldStartLocalScheduler.mockResolvedValueOnce(true);

      await initWorkerAndScheduler(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      await Promise.resolve();

      expect(mockOrchestrator.agentWorker).toBeDefined();
      const worker = mockOrchestrator.agentWorker!;

      expect(worker.postMessage).toHaveBeenCalledWith({
        type: "set-storage",
        payload: { storageHandle: "store-handle-xyz" },
      });

      // worker.onmessage
      expect(worker.onmessage).not.toBeNull();
      worker.onmessage!({ data: { type: "test-msg" } });
      expect(mockHandleWorkerMessage).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
        { type: "test-msg" },
      );

      // worker.onerror
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      expect(worker.onerror).not.toBeNull();
      worker.onerror!(new Error("Worker failure"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Agent worker error:",
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();

      // TaskScheduler start and callbacks
      expect(mockTaskSchedulerStart).toHaveBeenCalled();
      expect(capturedTaskExecutor).not.toBeNull();
      expect(capturedTaskOnExecuted).not.toBeNull();

      const testTask: Task = {
        id: "task-1",
        name: "Test task",
        groupId: "g1",
        schedule: "0 * * * *",
        lastRun: null,
        prompt: "do work",
        enabled: true,
        createdAt: Date.now(),
      };
      await capturedTaskExecutor!(testTask);
      expect(mockRunTaskAsScheduled).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
        testTask,
      );

      capturedTaskOnExecuted!();
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("task-change", {
        type: "executed",
      });

      expect(mockSetupPushTaskListener).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      expect(mockSyncProxyConfigToServiceWorker).toHaveBeenCalledWith(
        mockOrchestrator as unknown as Orchestrator,
      );
    });

    it("should not start scheduler when shouldStartLocalScheduler returns false and skip storage when absent", async () => {
      mockGetConfig.mockResolvedValueOnce(undefined); // no storage handle
      mockShouldStartLocalScheduler.mockResolvedValueOnce(false);

      await initWorkerAndScheduler(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
      );
      await Promise.resolve();

      expect(mockTaskSchedulerStart).not.toHaveBeenCalled();
      expect(mockOrchestrator.agentWorker?.postMessage).not.toHaveBeenCalled();
    });
  });
});
