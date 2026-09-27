import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ProviderConfig } from "../../../config/config.js";
import type { MessageAttachment } from "../../../content/types.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { GroupMeta, StoredMessage } from "../../../db/types.js";
import type {
  ChannelType,
  InboundMessage,
} from "../../../subsystems/channels/types.js";
import type {
  SkillDiagnostic,
  SkillRecord,
} from "../../../subsystems/skills/types.js";
import type { Orchestrator } from "../orchestrator.js";
import type { ParsedDirectToolCommand } from "./types.js";

const mockClearPeerJsTypingState = jest.fn<(groupId: string) => void>();
jest.unstable_mockModule("./operations/channel.js", () => ({
  clearPeerJsTypingState: mockClearPeerJsTypingState,
}));

const mockParseDirectToolCommand =
  jest.fn<
    (
      policy: unknown,
      assistantName: string,
      msg: InboundMessage,
    ) => ParsedDirectToolCommand | null
  >();
jest.unstable_mockModule("./parseDirectToolCommand.js", () => ({
  parseDirectToolCommand: mockParseDirectToolCommand,
}));

const mockDiscoverSkills =
  jest.fn<
    (
      db: ShadowClawDatabase,
      groupId: string,
    ) => Promise<{ skills: SkillRecord[]; diagnostics: SkillDiagnostic[] }>
  >();
jest.unstable_mockModule(
  "../../../subsystems/skills/discoverSkills.js",
  () => ({ discoverSkills: mockDiscoverSkills }),
);

const mockGetApiKeyForRequest =
  jest.fn<(o: Orchestrator) => Promise<string | null>>();
jest.unstable_mockModule("./operations/provider.js", () => ({
  getApiKeyForRequest: mockGetApiKeyForRequest,
}));

const mockDetectProviderHelpType =
  jest.fn<
    (providerId: string, reason: string, requiresApiKey: boolean) => string
  >();
const mockGetProvider = jest.fn<(id: string) => ProviderConfig | null>();
const mockPersistMessageAttachments =
  jest.fn<
    (
      db: ShadowClawDatabase,
      groupId: string,
      attachments: MessageAttachment[],
    ) => Promise<MessageAttachment[]>
  >();
const mockListGroups =
  jest.fn<(db: ShadowClawDatabase) => Promise<GroupMeta[]>>();
const mockSaveMessage =
  jest.fn<(db: ShadowClawDatabase, msg: StoredMessage) => Promise<void>>();

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

const mockInvokeAgent =
  jest.fn<
    (
      o: unknown,
      db: unknown,
      groupId: string,
      content: string,
      freshContext?: boolean,
      subagent?: boolean,
    ) => Promise<void>
  >();
jest.unstable_mockModule("./invokeAgent.js", () => ({
  invokeAgent: mockInvokeAgent,
}));

const { clearPeerJsTypingState } = await import("./operations/channel.js");
const { enqueue, processQueue } = await import("./enqueue.js");

interface MockOrchestrator {
  events: {
    emit: jest.Mock<(_event: string, _payload: unknown) => void>;
  };
  channelRegistry: {
    shouldAutoTrigger: jest.Mock<(_channel: ChannelType) => boolean>;
  };
  triggerPattern: RegExp;
  peerCompletedContexts: Set<string>;
  peerjsMyPeerId: string;
  peerjsMyAlias: string;
  peerjsPeerAliases: Record<string, string>;
  messageQueue: Array<{
    groupId: string;
    content: string;
    freshContext?: boolean;
    subagent?: boolean;
  }>;
  clearPeerJsTypingState: jest.Mock<() => void>;
  router: {
    send: jest.Mock<
      (
        _groupId: string,
        _content: string,
        _attachments: MessageAttachment[],
      ) => Promise<void>
    >;
  };
  agentWorker: {
    postMessage: jest.Mock<(_msg: unknown) => void>;
  };
  processQueue: jest.Mock<() => void>;
  providerConfig: {
    requiresApiKey: boolean;
  };
  provider: string;
  getApiKey: jest.Mock<() => Promise<string | null>>;
  getApiKeyForSpecificProvider: jest.Mock<
    (_db: ShadowClawDatabase, _prov: string) => Promise<string | null>
  >;
  directToolCommandPolicy: {
    enabledChannelTypes: ChannelType[];
  };
  assistantName: string;
  processing: boolean;
}

function makeInboundMessage(
  overrides: Partial<InboundMessage> = {},
): InboundMessage {
  return {
    id: "msg-1",
    groupId: "g1",
    sender: "user",
    content: "test message",
    timestamp: Date.now(),
    channel: "browser",
    ...overrides,
  };
}

describe("enqueue & processQueue", () => {
  let mockOrchestrator: MockOrchestrator;
  const mockDb = {} as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrchestrator = {
      events: { emit: jest.fn() },
      channelRegistry: {
        shouldAutoTrigger: jest
          .fn<(_channel: ChannelType) => boolean>()
          .mockReturnValue(false),
      },
      triggerPattern: /trigger/i,
      peerCompletedContexts: new Set<string>(),
      peerjsMyPeerId: "my-id",
      peerjsMyAlias: "my-alias",
      peerjsPeerAliases: { "peer2-alias": "peer2-id" },
      messageQueue: [],
      clearPeerJsTypingState: jest.fn(),
      router: {
        send: jest
          .fn<
            (
              _groupId: string,
              _content: string,
              _attachments: MessageAttachment[],
            ) => Promise<void>
          >()
          .mockResolvedValue(undefined),
      },
      agentWorker: { postMessage: jest.fn() },
      processQueue: jest.fn(),
      providerConfig: { requiresApiKey: true },
      provider: "test-provider",
      getApiKey: jest
        .fn<() => Promise<string | null>>()
        .mockResolvedValue("key"),
      getApiKeyForSpecificProvider: jest
        .fn<
          (_db: ShadowClawDatabase, _prov: string) => Promise<string | null>
        >()
        .mockResolvedValue("key"),
      directToolCommandPolicy: {
        enabledChannelTypes: ["browser", "peerjs"],
      },
      assistantName: "Assistant",
      processing: false,
    };

    mockParseDirectToolCommand.mockReturnValue(null);
    mockDiscoverSkills.mockResolvedValue({ skills: [], diagnostics: [] });
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
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "",
        a2uiEnvelopes: [
          {
            surfaceId: "s1",
            data: {},
          } as unknown as InboundMessage["a2uiEnvelopes"] extends Array<infer U>
            ? U
            : never,
        ],
        a2uiAction: {
          actionId: "test",
        } as unknown as InboundMessage["a2uiAction"],
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
        "a2ui-surface",
        { groupId: "g1", envelope: { surfaceId: "s1", data: {} } },
      );
      expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("a2ui-action", {
        groupId: "g1",
        action: { actionId: "test" },
      });
      expect(mockSaveMessage).not.toHaveBeenCalled();
    });

    it("should proceed to normal handling if message has a2uiAction but no envelopes", async () => {
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "",
        a2uiAction: {
          actionId: "test-action",
        } as unknown as InboundMessage["a2uiAction"],
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalled();
    });

    it("should process normal message, detect trigger, persist and enqueue", async () => {
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "hello trigger",
        channel: "browser",
      });
      const persistedAttachment: MessageAttachment = {
        fileName: "test.png",
        mimeType: "image/png",
        path: "/path/test.png",
        size: 100,
      };
      mockPersistMessageAttachments.mockResolvedValue([persistedAttachment]);

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

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

    it("should auto-trigger from browser channel for regular conversations", async () => {
      const msg = makeInboundMessage({
        groupId: "normal-group",
        content: "regular message without keywords",
        channel: "browser",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(1);
    });

    it("should not auto-trigger from browser channel in peer and room channels", async () => {
      const peerMsg = makeInboundMessage({
        groupId: "peer:peer-1",
        content: "direct peer message",
        channel: "browser",
      });
      await enqueue(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
        peerMsg,
      );
      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: false }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(0);

      const roomMsg = makeInboundMessage({
        groupId: "room:room-1",
        content: "direct room message",
        channel: "browser",
      });
      await enqueue(
        mockOrchestrator as unknown as Orchestrator,
        mockDb,
        roomMsg,
      );
      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: false }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(0);
    });

    it("should reopen completed peer context when local user sends message from browser", async () => {
      mockOrchestrator.peerCompletedContexts.add("peer:finished-task");
      const msg = makeInboundMessage({
        groupId: "peer:finished-task",
        content: "reopen message",
        channel: "browser",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(
        mockOrchestrator.peerCompletedContexts.has("peer:finished-task"),
      ).toBe(false);
    });

    it("should suppress auto-trigger for peer conversations in peerCompletedContexts", async () => {
      mockOrchestrator.peerCompletedContexts.add("peer:finished-task");
      const msg = makeInboundMessage({
        groupId: "peer:finished-task",
        content: "hey @my-alias more work",
        channel: "peerjs",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: false }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(0);
    });

    it("should trigger if message mentions my exact peer ID", async () => {
      const msg = makeInboundMessage({
        groupId: "peer:group",
        content: "hey @my-id can you help?",
        channel: "peerjs",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(1);
    });

    it("should trigger if message mentions an alias mapping to peerjsMyPeerId", async () => {
      mockOrchestrator.peerjsPeerAliases = {
        "friendly-peer": "my-id",
        "other-peer": "different-id",
      };
      const msg = makeInboundMessage({
        groupId: "peer:group",
        content: "hey @friendly-peer check this out",
        channel: "peerjs",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(1);
    });

    it("should route a user-invocable skill slash command to the agent", async () => {
      const skill: SkillRecord = {
        name: "toast-random-number",
        description: "Show a random number",
        userInvocable: true,
        path: "/path/skill",
        basePath: "/path",
      };
      mockDiscoverSkills.mockResolvedValue({
        skills: [skill],
        diagnostics: [],
      });
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "/toast-random-number",
        channel: "peerjs",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockOrchestrator.messageQueue[0]).toEqual(
        expect.objectContaining({
          content:
            '[SKILL COMMAND] Activate the "toast-random-number" skill and follow its instructions.\n',
        }),
      );
      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ content: "/toast-random-number" }),
      );
    });

    it("should execute a declarative skill chain without queueing an agent turn", async () => {
      const skill: SkillRecord = {
        name: "toast-random-number",
        description: "Show a random number",
        userInvocable: true,
        path: "/path/skill",
        basePath: "/path",
        execution: {
          type: "tools",
          tools: [
            { name: "javascript", input: { code: "1" } },
            { name: "show_toast", input: { message: { $pipe: "prev" } } },
          ],
        },
      };
      mockDiscoverSkills.mockResolvedValue({
        skills: [skill],
        diagnostics: [],
      });
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "/toast-random-number",
        channel: "browser",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockOrchestrator.messageQueue).toHaveLength(0);
      expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
        type: "execute-skill-tools",
        payload: expect.objectContaining({
          groupId: "g1",
          skillName: "toast-random-number",
        }),
      });
    });

    it("should populate rawInput on declarative tools with arguments when input is empty or non-object", async () => {
      const skill: SkillRecord = {
        name: "echo-skill",
        description: "Echo skill with arguments",
        userInvocable: true,
        path: "/path/skill",
        basePath: "/path",
        execution: {
          type: "tools",
          tools: [
            { name: "tool-with-empty-input", input: {} },
            {
              name: "tool-with-non-object-input",
              input: null as unknown as Record<string, unknown>,
            },
            { name: "tool-with-existing-input", input: { existing: "val" } },
          ],
        },
      };
      mockDiscoverSkills.mockResolvedValue({
        skills: [skill],
        diagnostics: [],
      });
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "/echo-skill hello world arguments",
        channel: "browser",
      });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
        type: "execute-skill-tools",
        payload: {
          groupId: "g1",
          skillName: "echo-skill",
          tools: [
            {
              name: "tool-with-empty-input",
              input: { rawInput: "hello world arguments" },
            },
            {
              name: "tool-with-non-object-input",
              input: { rawInput: "hello world arguments" },
            },
            { name: "tool-with-existing-input", input: { existing: "val" } },
          ],
        },
      });
    });

    it("should handle direct tool commands without enqueuing for invokeAgent", async () => {
      mockParseDirectToolCommand.mockReturnValue({
        toolName: "tool1",
        input: { text: "input" },
      });
      const msg = makeInboundMessage({ groupId: "g1", content: "cmd" });

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(0);
      expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
        type: "execute-direct-tool",
        payload: { groupId: "g1", name: "tool1", input: { text: "input" } },
      });
    });

    it("should trigger if mentioned by peerjs alias", async () => {
      const msg = makeInboundMessage({
        groupId: "peer:g1",
        content: "hey @my-alias",
        channel: "peerjs",
      });
      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
      expect(mockOrchestrator.messageQueue).toHaveLength(1);
    });

    it("should trigger if scheduled task", async () => {
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "[SCHEDULED TASK] go",
      });
      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);
      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
    });

    it("should trigger if A2UI action message", async () => {
      const msg = makeInboundMessage({
        groupId: "g1",
        content: "[A2UI ACTION] click",
      });
      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);
      expect(mockSaveMessage).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ isTrigger: true }),
      );
    });

    it("should route browser message to peer channel and handle send errors", async () => {
      const msg = makeInboundMessage({
        groupId: "peer:g1",
        content: "hello",
        channel: "browser",
      });
      mockOrchestrator.router.send.mockRejectedValueOnce(
        new Error("Network drop"),
      );
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);

      expect(mockOrchestrator.router.send).toHaveBeenCalledWith(
        "peer:g1",
        "hello",
        [],
      );
      await Promise.resolve();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to route browser message to peer:",
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    it("should clear peerJs typing state for peerjs channel", async () => {
      const msg = makeInboundMessage({
        groupId: "peer:g1",
        content: "hello",
        channel: "peerjs",
      });
      await enqueue(mockOrchestrator as unknown as Orchestrator, mockDb, msg);
      expect(clearPeerJsTypingState).toHaveBeenCalledWith("peer:g1");
    });
  });

  describe("processQueue", () => {
    it("should do nothing if processing or queue is empty", async () => {
      mockOrchestrator.processing = true;
      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);
      expect(mockInvokeAgent).not.toHaveBeenCalled();

      mockOrchestrator.processing = false;
      mockOrchestrator.messageQueue = [];
      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);
      expect(mockInvokeAgent).not.toHaveBeenCalled();
    });

    it("should process next message if API key present", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);
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

    it("should process message without checking API key if provider does not require one", async () => {
      mockOrchestrator.messageQueue = [
        { groupId: "g1", content: "local message" },
      ];
      mockOrchestrator.providerConfig = { requiresApiKey: false };

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

      expect(mockGetApiKeyForRequest).not.toHaveBeenCalled();
      expect(mockInvokeAgent).toHaveBeenCalledWith(
        mockOrchestrator,
        mockDb,
        "g1",
        "local message",
        undefined,
        undefined,
      );
    });

    it("should process message without groupId lookup when nextMsg groupId is empty", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "", content: "no group" }];

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

      expect(mockListGroups).not.toHaveBeenCalled();
      expect(mockInvokeAgent).toHaveBeenCalledWith(
        mockOrchestrator,
        mockDb,
        "",
        "no group",
        undefined,
        undefined,
      );
    });

    it("should fallback to default provider if pinned provider is not found", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockListGroups.mockResolvedValue([
        {
          groupId: "g1",
          name: "Group 1",
          createdAt: Date.now(),
          pinnedProvider: "unknown-prov",
        } as GroupMeta,
      ]);
      mockGetProvider.mockReturnValue(null);

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

      expect(mockInvokeAgent).toHaveBeenCalledWith(
        mockOrchestrator,
        mockDb,
        "g1",
        "hello",
        undefined,
        undefined,
      );
    });

    it("should handle listGroups error gracefully in processQueue", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockListGroups.mockRejectedValueOnce(new Error("Storage unavailable"));

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

      expect(mockInvokeAgent).toHaveBeenCalledWith(
        mockOrchestrator,
        mockDb,
        "g1",
        "hello",
        undefined,
        undefined,
      );
    });

    it("should emit provider-help if API key missing", async () => {
      mockOrchestrator.messageQueue = [{ groupId: "g1", content: "hello" }];
      mockGetApiKeyForRequest.mockResolvedValue(null);
      mockDetectProviderHelpType.mockReturnValue("help");

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

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

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

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

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

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
        {
          groupId: "g1",
          name: "Group 1",
          createdAt: Date.now(),
          pinnedProvider: "pinned-prov",
        } as GroupMeta,
      ]);
      mockGetProvider.mockReturnValue({
        id: "pinned-prov",
        name: "Pinned Provider",
        requiresApiKey: true,
      } as unknown as ProviderConfig);
      mockOrchestrator.getApiKeyForSpecificProvider.mockResolvedValue(
        "pinned-key",
      );

      await processQueue(mockOrchestrator as unknown as Orchestrator, mockDb);

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
