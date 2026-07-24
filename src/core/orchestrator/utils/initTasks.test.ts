import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { CONFIG_KEYS } from "../../../config/config.js";

const mockDeleteRoom = (jest.fn() as any).mockResolvedValue(undefined);
const mockFetchModelInfo = (jest.fn() as any).mockResolvedValue(undefined);
const mockGetConfig = jest.fn() as any;
const mockGetRoomMetadata = jest.fn() as any;
const mockRoomManager = (jest.fn() as any).mockImplementation(
  (config: any) => ({ loadRooms: mockRoomManagerLoadRooms, config }),
);
const mockRoomManagerLoadRooms = jest.fn() as any;
const mockSetConfig = jest.fn() as any;
const mockSetRemoteAgentTyping = jest.fn() as any;
const mockSetWebMcpMode = jest.fn() as any;
const mockTaskScheduler = (jest.fn() as any).mockImplementation(() => ({
  start: mockTaskSchedulerStart,
}));
const mockTaskSchedulerStart = jest.fn() as any;
const mockToTrustedScriptUrl = (jest.fn() as any).mockImplementation(
  (url: string) => url,
);
const mockUpsertRoom = (jest.fn() as any).mockResolvedValue(undefined);

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("../../../db/rooms.js", () => ({
  getRoomMetadata: mockGetRoomMetadata,
  upsertRoom: mockUpsertRoom,
  deleteRoom: mockDeleteRoom,
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

const {
  createRoomManager,
  initChannelsAndRooms,
  initCoreConfig,
  initFeatureFlagsAndLimits,
  initLlamafileAndMesh,
  initProviderAndModel,
  initWorkerAndScheduler,
} = await import("./initTasks.js");

const { TaskScheduler } =
  await import("../../../subsystems/tools/task-scheduler.js");

const { RoomManager } =
  await import("../../../subsystems/channels/room-manager.js");

class MockWorker {
  onmessage: any = null;
  onerror: any = null;
  postMessage = jest.fn();
  constructor(
    public scriptURL: string | URL,
    public options?: WorkerOptions,
  ) {}
}

describe("initTasks", () => {
  let mockOrchestrator: any;
  let mockDb: any;
  let originalWorker: any;

  beforeAll(() => {
    originalWorker = global.Worker;
    (global as any).Worker = MockWorker;
  });

  afterAll(() => {
    (global as any).Worker = originalWorker;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {};
    mockOrchestrator = {
      peerjs: {
        myPeerId: "peer1",
        sendRoomNotification: jest.fn(),
        isPeerConnected: jest.fn(),
        connectPeer: jest.fn(),
        onTaskComplete: jest.fn(),
      },
      peerjsMyAlias: "my-alias",
      assistantName: "Assistant",
      roomChannel: { deliverInbound: jest.fn() },
      handleRoomInvite: jest.fn(),
      db: mockDb,
      channelRegistry: {
        onMessage: jest.fn(),
        onTyping: jest.fn(),
      },
      enqueue: (jest.fn() as any).mockResolvedValue(undefined),
      events: { emit: jest.fn() },
      peerCompletedContexts: new Set(),
      loadChannelConfigurations: (jest.fn() as any).mockResolvedValue(
        undefined,
      ),
      applyAllChannelRunningStates: jest.fn(),
      roomManager: { loadRooms: jest.fn() },
      initializeChannelRegistry: jest.fn(),
      applyLlamafileHeaders: jest.fn(),
      applyMeshLlmHeaders: jest.fn(),
      getApiKeyForHeaders: (jest.fn() as any).mockResolvedValue("key"),
      getProviderRuntimeHeaders: jest.fn().mockReturnValue({}),
      loadApiKeyForProvider: (jest.fn() as any).mockResolvedValue(undefined),
      syncProxyConfigToServiceWorker: jest.fn(),
      runTaskAsScheduled: (jest.fn() as any).mockResolvedValue(undefined),
      shouldStartLocalScheduler: (jest.fn() as any).mockResolvedValue(true),
      setupPushTaskListener: jest.fn(),
      handleWorkerMessage: jest.fn(),
      providerConfig: { defaultModel: "default-model" },
    };

    (mockGetConfig as any).mockResolvedValue(null);
  });

  describe("createRoomManager", () => {
    it("should create a room manager with correct transport and handlers", () => {
      const roomManager = createRoomManager(mockOrchestrator) as any;
      expect(RoomManager).toHaveBeenCalled();

      const config = roomManager.config;
      expect(config.transport.myPeerId).toBe("peer1");

      config.transport.sendToPeer("peer2", {} as any);
      expect(mockOrchestrator.peerjs.sendRoomNotification).toHaveBeenCalledWith(
        "peer2",
        {},
      );

      const member = config.getLocalMember();
      expect(member).toEqual({
        peerId: "peer1",
        alias: "my-alias",
        kind: "agent",
        agentName: "Assistant",
      });

      config.onMessage({ id: "msg1" } as any);
      expect(mockOrchestrator.roomChannel.deliverInbound).toHaveBeenCalledWith({
        id: "msg1",
      });

      config.persistRoom({ id: "room1" });
      expect(mockUpsertRoom).toHaveBeenCalledWith(mockDb, { id: "room1" });

      config.removeRoom("room1");
      expect(mockDeleteRoom).toHaveBeenCalledWith(mockDb, "room1");
    });
  });

  describe("initChannelsAndRooms", () => {
    it("should initialize channels, events, and rooms", async () => {
      (mockGetRoomMetadata as any).mockResolvedValue([{ id: "room1" }]);

      await initChannelsAndRooms(mockOrchestrator, mockDb);

      expect(mockOrchestrator.initializeChannelRegistry).toHaveBeenCalled();
      expect(mockOrchestrator.channelRegistry.onMessage).toHaveBeenCalled();
      expect(mockOrchestrator.channelRegistry.onTyping).toHaveBeenCalled();
      expect(mockOrchestrator.peerjs.onTaskComplete).toHaveBeenCalled();
      expect(mockOrchestrator.loadChannelConfigurations).toHaveBeenCalledWith(
        mockDb,
      );
      expect(mockOrchestrator.applyAllChannelRunningStates).toHaveBeenCalled();

      // Simulate onMessage callback
      const onMessageCb =
        mockOrchestrator.channelRegistry.onMessage.mock.calls[0][0];
      onMessageCb({ id: "msg1" });
      expect(mockOrchestrator.enqueue).toHaveBeenCalledWith(mockDb, {
        id: "msg1",
      });

      // Simulate onTyping callback
      const onTypingCb =
        mockOrchestrator.channelRegistry.onTyping.mock.calls[0][0];
      onTypingCb("peer:123", true);
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("typing", {
        groupId: "peer:123",
        typing: true,
      });
      expect(mockSetRemoteAgentTyping).toHaveBeenCalledWith("peer:123", true);

      // Simulate onTaskComplete callback
      const onTaskCompleteCb =
        mockOrchestrator.peerjs.onTaskComplete.mock.calls[0][0];
      onTaskCompleteCb("group1");
      expect(mockOrchestrator.peerCompletedContexts.has("group1")).toBe(true);

      expect(mockGetRoomMetadata).toHaveBeenCalledWith(mockDb);
      expect(mockOrchestrator.roomManager.loadRooms).toHaveBeenCalledWith([
        { id: "room1" },
      ]);
    });
  });

  describe("initCoreConfig", () => {
    it("should load core config correctly", async () => {
      mockGetConfig.mockResolvedValueOnce("My Bot");
      await initCoreConfig(mockOrchestrator, mockDb);
      expect(mockOrchestrator.assistantName).toBe("My Bot");
      expect(mockOrchestrator.triggerPattern).toBeDefined();
    });
  });

  describe("initFeatureFlagsAndLimits", () => {
    it("should load feature flags correctly", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.VM_BOOT_MODE) return "ext2";
        if (key === CONFIG_KEYS.STREAMING_ENABLED) return "true";
        if (key === CONFIG_KEYS.WEBMCP_TOOLS_ENABLED) return "false";
        if (key === CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS) return "true";
        if (key === CONFIG_KEYS.WEBMCP_MODE) return "native";
        if (key === CONFIG_KEYS.CONTEXT_COMPRESSION_ENABLED) return "true";
        if (key === CONFIG_KEYS.REASONING_EFFORT) return "High";
        if (key === CONFIG_KEYS.USE_PROXY) return "true";
        if (key === CONFIG_KEYS.PROXY_URL) return "http://proxy";
        return null;
      });

      await initFeatureFlagsAndLimits(mockOrchestrator, mockDb);

      expect(mockOrchestrator.vmBootMode).toBe("ext2");
      expect(mockOrchestrator.streamingEnabled).toBe(true);
      expect(mockOrchestrator.webMcpToolsEnabled).toBe(false);
      expect(mockOrchestrator.vmBashFullInternetAccess).toBe(true);
      expect(mockSetWebMcpMode).toHaveBeenCalledWith("native");
      expect(mockOrchestrator.contextCompressionEnabled).toBe(true);
      expect(mockOrchestrator.reasoningEffort).toBe("high");
      expect(mockOrchestrator.useProxy).toBe(true);
      expect(mockOrchestrator.proxyUrl).toBe("http://proxy");
    });
  });

  describe("initLlamafileAndMesh", () => {
    it("should set llamafile modes", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.LLAMAFILE_MODE) return "cli";
        if (key === CONFIG_KEYS.LLAMAFILE_HOST) return "http://localhost:8080";
        if (key === CONFIG_KEYS.LLAMAFILE_PORT) return "9090";
        if (key === CONFIG_KEYS.LLAMAFILE_OFFLINE) return "false";
        if (key === CONFIG_KEYS.MESH_LLM_HOST) return "mesh-host";
        return null;
      });

      await initLlamafileAndMesh(mockOrchestrator, mockDb);

      expect(mockOrchestrator.llamafileMode).toBe("cli");
      expect(mockOrchestrator.llamafileHost).toBe("http://localhost:8080");
      expect(mockOrchestrator.llamafilePort).toBe(9090);
      expect(mockOrchestrator.llamafileOffline).toBe(false);
      expect(mockOrchestrator.meshLlmHost).toBe("mesh-host");
    });
  });

  describe("initProviderAndModel", () => {
    it("should load provider and model config correctly", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.PROVIDER) return "openrouter";
        if (key === CONFIG_KEYS.MODEL) return "gpt-4";
        if (key === CONFIG_KEYS.MAX_TOKENS) return "4096";
        if (key === CONFIG_KEYS.MAX_ITERATIONS) return "10";
        if (key === CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE) return "20";
        if (key === CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT) return "false";
        return null;
      });

      await initProviderAndModel(mockOrchestrator, mockDb);

      expect(mockOrchestrator.provider).toBe("openrouter");
      expect(mockOrchestrator.model).toBe("gpt-4");
      expect(mockOrchestrator.maxIterations).toBe(10);
      expect(mockOrchestrator.rateLimitCallsPerMinute).toBe(20);
      expect(mockOrchestrator.rateLimitAutoAdapt).toBe(false);
      expect(mockFetchModelInfo).toHaveBeenCalled();
    });
  });

  describe("initWorkerAndScheduler", () => {
    it("should spawn worker and start scheduler", async () => {
      mockGetConfig.mockImplementation(async (_db, key) => {
        if (key === CONFIG_KEYS.STORAGE_HANDLE) return "handle-123";
        return null;
      });

      await initWorkerAndScheduler(mockOrchestrator, mockDb);

      expect(mockOrchestrator.agentWorker).toBeDefined();
      expect(
        mockOrchestrator.syncProxyConfigToServiceWorker,
      ).toHaveBeenCalled();
      expect(TaskScheduler).toHaveBeenCalled();

      const schedulerInstance = (TaskScheduler as jest.Mock).mock.results[0]
        .value;
      expect((schedulerInstance as any).start).toHaveBeenCalled();
      expect(mockOrchestrator.setupPushTaskListener).toHaveBeenCalledWith(
        mockDb,
      );

      // Verify worker messaging
      expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
        type: "set-storage",
        payload: { storageHandle: "handle-123" },
      });

      // Trigger worker message
      mockOrchestrator.agentWorker.onmessage({ data: { type: "test" } } as any);
      expect(mockOrchestrator.handleWorkerMessage).toHaveBeenCalledWith(
        mockDb,
        { type: "test" },
      );

      // Trigger scheduler task
      const schedulerCb: any = (TaskScheduler as jest.Mock).mock.calls[0][0];
      await schedulerCb({ id: "task1" });
      expect(mockOrchestrator.runTaskAsScheduled).toHaveBeenCalledWith({
        id: "task1",
      });
    });
  });
});
