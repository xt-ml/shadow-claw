import { beforeEach, describe, expect, it, jest } from "@jest/globals";

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
      parseDirectToolCommand: jest.fn().mockReturnValue(null),
      processQueue: jest.fn(),
      invokeAgent: (jest.fn() as any).mockResolvedValue(undefined),
      providerConfig: { requiresApiKey: true },
      provider: "test-provider",
      getApiKeyForRequest: (jest.fn() as any).mockResolvedValue("key"),
      getApiKeyForSpecificProvider: (jest.fn() as any).mockResolvedValue("key"),
      processing: false,
    };

    mockPersistMessageAttachments.mockResolvedValue([]);
    mockListGroups.mockResolvedValue([]);
  });

  describe("enqueue", () => {
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
      expect(mockOrchestrator.processQueue).toHaveBeenCalledWith(mockDb);
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
        "message",
        expect.any(Object),
      );
    });

    it("should handle direct tool commands without enqueuing for invokeAgent", async () => {
      mockOrchestrator.parseDirectToolCommand.mockReturnValue({
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
      expect(mockOrchestrator.processQueue).not.toHaveBeenCalled();
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
      expect(mockOrchestrator.clearPeerJsTypingState).toHaveBeenCalledWith(
        "peer:g1",
      );
    });
  });

  describe("processQueue", () => {
    it("should do nothing if processing or queue is empty", async () => {
      mockOrchestrator.processing = true;
      await processQueue(mockOrchestrator, mockDb);
      expect(mockOrchestrator.invokeAgent).not.toHaveBeenCalled();

      mockOrchestrator.processing = false;
      mockOrchestrator.messageQueue = [];
      await processQueue(mockOrchestrator, mockDb);
      expect(mockOrchestrator.invokeAgent).not.toHaveBeenCalled();
    });

    it("should process next message if API key present", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      await processQueue(mockOrchestrator, mockDb);
      expect(mockOrchestrator.invokeAgent).toHaveBeenCalledWith(
        mockDb,
        "g1",
        "hello",
      );
      expect(mockOrchestrator.processing).toBe(false);
      expect(mockOrchestrator.messageQueue).toHaveLength(0);
    });

    it("should emit provider-help if API key missing", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockOrchestrator.getApiKeyForRequest.mockResolvedValue(null);
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
      expect(mockOrchestrator.invokeAgent).not.toHaveBeenCalled();
    });

    it("should handle error in invokeAgent", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockOrchestrator.invokeAgent.mockRejectedValue(new Error("Test err"));
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

      // Simulate a real processQueue recursion since we mocked it
      mockOrchestrator.invokeAgent.mockImplementation(() => {
        // do nothing
      });

      // Need to make sure the mocked processQueue doesn't get called in finally but original does
      // Wait, we mocked it on `mockOrchestrator` but processQueue calls `o.processQueue`.
      // Let's bind it so it recursively calls our mocked function.
      mockOrchestrator.processQueue = jest.fn();

      await processQueue(mockOrchestrator, mockDb);

      expect(mockOrchestrator.invokeAgent).toHaveBeenCalledWith(
        mockDb,
        "g1",
        "msg1",
      );
      expect(mockOrchestrator.processQueue).toHaveBeenCalled();
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
      expect(mockOrchestrator.invokeAgent).toHaveBeenCalledWith(
        mockDb,
        "g1",
        "hello",
      );
    });
  });
});
