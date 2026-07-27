import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockClearPeerJsTypingState = jest.fn();
jest.unstable_mockModule("./operations/channel.js", () => ({
  clearPeerJsTypingState: mockClearPeerJsTypingState,
}));

const { clearPeerJsTypingState } = await import("./operations/channel.js");

const mockParseDirectToolCommand = jest.fn() as any;
jest.unstable_mockModule("./parseDirectToolCommand.js", () => ({
  parseDirectToolCommand: mockParseDirectToolCommand,
}));

const mockGetApiKeyForRequest = jest.fn() as any;
jest.unstable_mockModule("./operations/provider.js", () => ({
  getApiKeyForRequest: mockGetApiKeyForRequest,
}));

const mockDetectProviderHelpType = jest.fn() as any;
const mockGetProvider = jest.fn() as any;
const mockPersistMessageAttachments = jest.fn() as any;
const mockListGroups = jest.fn() as any;
const mockSaveMessage = jest.fn() as any;

jest.unstable_mockModule(
  "../../../components/common/help/providers.js",
  () => ({
    detectProviderHelpType: mockDetectProviderHelpType,
  }),
);

jest.unstable_mockModule("../../../config/config.js", () => ({
  getProvider: mockGetProvider,
  CONFIG_KEYS: { STORAGE_HANDLE: "STORAGE_HANDLE" },
  GENERAL_ACCOUNT_PROVIDER_CAPABILITIES: [],
  PROVIDERS: {},
  buildTriggerPattern: jest.fn().mockReturnValue(new RegExp("")),
  BASH_DEFAULT_TIMEOUT_SEC: 60,
  BASH_MAX_TIMEOUT_SEC: 300,
  getModelMaxTokens: jest.fn().mockReturnValue(128000),
}));

jest.unstable_mockModule("../../../content/message-attachments.js", () => ({
  persistMessageAttachments: mockPersistMessageAttachments,
}));

jest.unstable_mockModule("../../../db/groups.js", () => ({
  listGroups: mockListGroups,
}));

jest.unstable_mockModule("../../../db/saveMessage.js", () => ({
  saveMessage: mockSaveMessage,
}));

const mockInvokeAgent = jest.fn() as any;
jest.unstable_mockModule("./invokeAgent.js", () => ({
  invokeAgent: mockInvokeAgent,
}));

const { enqueue, processQueue } = await import("./enqueue.js");

describe("enqueue & processQueue", () => {
  let mockOrchestrator: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {};
    mockOrchestrator = {
      events: { emit: jest.fn() },
      channelRegistry: { shouldAutoTrigger: jest.fn().mockReturnValue(false) },
      triggerPattern: /trigger/i,
      peerCompletedContexts: new Set(),
      peerjsMyPeerId: "my-id",
      peerjsMyAlias: "my-alias",
      peerjsPeerAliases: { "peer2-alias": "peer2-id" },
      messageQueue: [],
      clearPeerJsTypingState: jest.fn(),
      router: { send: (jest.fn() as any).mockResolvedValue(undefined) },
      agentWorker: { postMessage: jest.fn() },
      processQueue: jest.fn(),
      providerConfig: { requiresApiKey: true },
      provider: "test-provider",
      getApiKey: (jest.fn() as any).mockResolvedValue("key"),
      getApiKeyForSpecificProvider: (jest.fn() as any).mockResolvedValue("key"),
      directToolCommandPolicy: {
        enabledChannelTypes: ["browser", "peerjs", "web"],
      },
      assistantName: "Assistant",
      processing: false,
    };

    mockParseDirectToolCommand.mockReturnValue(null);
    mockGetApiKeyForRequest.mockResolvedValue("key");
    mockPersistMessageAttachments.mockResolvedValue([]);
    mockListGroups.mockResolvedValue([]);
    mockInvokeAgent.mockResolvedValue(undefined);
  });

  describe("enqueue", () => {
    beforeEach(() => {
      mockOrchestrator.processing = true;
    });

    it("should emit A2UI envelopes and actions and exit if no text/attachments", async () => {
      const msg: any = {
        groupId: "g1",
        a2uiEnvelopes: [{ type: "test" }],
        a2uiAction: { action: "test" },
      };

      await enqueue(mockOrchestrator, mockDb, msg);

      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
        "a2ui-surface",
        { groupId: "g1", envelope: { type: "test" } },
      );
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("a2ui-action", {
        groupId: "g1",
        action: { action: "test" },
      });
      expect(mockSaveMessage).not.toHaveBeenCalled();
    });

    it("should process normal message, detect trigger, persist and enqueue", async () => {
      const msg: any = {
        groupId: "g1",
        content: "hello trigger",
        channel: "browser",
      };
      mockPersistMessageAttachments.mockResolvedValue([{ name: "test.png" }]);

      await enqueue(mockOrchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(1);
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
        "message",
        expect.any(Object),
      );
    });

    it("should handle direct tool commands without enqueuing for invokeAgent", async () => {
      mockParseDirectToolCommand.mockReturnValue({
        toolName: "tool1",
        input: "input",
      });
      const msg: any = { groupId: "g1", content: "cmd" };

      await enqueue(mockOrchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(0);
      expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
        type: "execute-direct-tool",
        payload: { groupId: "g1", name: "tool1", input: "input" },
      });
    });

    it("should trigger if mentioned by peerjs alias", async () => {
      const msg: any = {
        groupId: "peer:g1",
        content: "hey @my-alias",
        channel: "peerjs",
      };
      await enqueue(mockOrchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(1);
    });

    it("should trigger if scheduled task", async () => {
      const msg: any = { groupId: "g1", content: "[SCHEDULED TASK] go" };
      await enqueue(mockOrchestrator, mockDb, msg);
      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
    });

    it("should trigger if A2UI action message", async () => {
      const msg: any = { groupId: "g1", content: "[A2UI ACTION] click" };
      await enqueue(mockOrchestrator, mockDb, msg);
      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
    });

    it("should route browser message to peer channel", async () => {
      const msg: any = {
        groupId: "peer:g1",
        content: "hello",
        channel: "browser",
      };
      await enqueue(mockOrchestrator, mockDb, msg);
      expect(mockOrchestrator.router.send).toHaveBeenCalledWith(
        "peer:g1",
        "hello",
        [],
      );
    });

    it("should clear peerJs typing state for peerjs channel", async () => {
      const msg: any = {
        groupId: "peer:g1",
        content: "hello",
        channel: "peerjs",
      };
      await enqueue(mockOrchestrator, mockDb, msg);
      expect(clearPeerJsTypingState).toHaveBeenCalledWith("peer:g1");
    });
  });

  describe("processQueue", () => {
    it("should do nothing if processing or queue is empty", async () => {
      mockOrchestrator.processing = true;
      await processQueue(mockOrchestrator, mockDb);
      expect(mockInvokeAgent).not.toHaveBeenCalled();

      mockOrchestrator.processing = false;
      mockOrchestrator.messageQueue = [];
      await processQueue(mockOrchestrator, mockDb);
      expect(mockInvokeAgent).not.toHaveBeenCalled();
    });

    it("should process next message if API key present", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      await processQueue(mockOrchestrator, mockDb);
      expect(mockInvokeAgent).toHaveBeenCalledWith(
        mockOrchestrator,
        mockDb,
        "g1",
        "hello",
        undefined,
        undefined,
      );
      expect(mockOrchestrator.processing).toBe(false);
      expect(mockOrchestrator.messageQueue).toHaveLength(0);
    });

    it("should emit provider-help if API key missing", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockGetApiKeyForRequest.mockResolvedValue(null);
      mockDetectProviderHelpType.mockReturnValue("help");

      await processQueue(mockOrchestrator, mockDb);

      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
        "provider-help",
        expect.any(Object),
      );
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
        "error",
        expect.any(Object),
      );
      expect(mockInvokeAgent).not.toHaveBeenCalled();
    });

    it("should handle error in invokeAgent", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockInvokeAgent.mockRejectedValue(new Error("Test err"));
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await processQueue(mockOrchestrator, mockDb);

      expect(consoleError).toHaveBeenCalled();
      expect(mockOrchestrator.processing).toBe(false);

      consoleError.mockRestore();
    });

    it("should process next item recursively if queue has more", async () => {
      mockOrchestrator.messageQueue = [
        { groupId: "g1", content: "msg1" },
        { groupId: "g2", content: "msg2" },
      ];

      mockInvokeAgent.mockImplementation(() => Promise.resolve());

      await processQueue(mockOrchestrator, mockDb);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInvokeAgent).toHaveBeenNthCalledWith(
        1,
        mockOrchestrator,
        mockDb,
        "g1",
        "msg1",
        undefined,
        undefined,
      );
      expect(mockInvokeAgent).toHaveBeenNthCalledWith(
        2,
        mockOrchestrator,
        mockDb,
        "g2",
        "msg2",
        undefined,
        undefined,
      );
    });

    it("should lookup pinned provider for API key check", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockListGroups.mockResolvedValue([
        { groupId: "g1", pinnedProvider: "pinned-prov" },
      ]);
      mockGetProvider.mockReturnValue({ requiresApiKey: true });
      mockOrchestrator.getApiKeyForSpecificProvider.mockResolvedValue(
        "pinned-key",
      );

      await processQueue(mockOrchestrator, mockDb);

      expect(
        mockOrchestrator.getApiKeyForSpecificProvider,
      ).toHaveBeenCalledWith(mockDb, "pinned-prov");
      expect(mockInvokeAgent).toHaveBeenCalledWith(
        mockOrchestrator,
        mockDb,
        "g1",
        "hello",
        undefined,
        undefined,
      );
    });
  });
});
