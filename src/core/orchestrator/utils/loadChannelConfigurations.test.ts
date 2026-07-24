import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetConfig = jest.fn() as any;
const mockInferAttachmentMimeType = jest.fn() as any;
const mockReadGroupFileBytes = jest.fn() as any;
const mockParseStoredStringList = jest.fn() as any;

jest.unstable_mockModule("../../../config/config.js", () => ({
  CONFIG_KEYS: {
    TELEGRAM_BOT_TOKEN: "TELEGRAM_BOT_TOKEN",
    TELEGRAM_CHAT_IDS: "TELEGRAM_CHAT_IDS",
    TELEGRAM_USE_PROXY: "TELEGRAM_USE_PROXY",
    IMESSAGE_SERVER_URL: "IMESSAGE_SERVER_URL",
    IMESSAGE_API_KEY: "IMESSAGE_API_KEY",
    IMESSAGE_CHAT_IDS: "IMESSAGE_CHAT_IDS",
    PEERJS_MY_PEER_ID: "PEERJS_MY_PEER_ID",
    PEERJS_TRUSTED_PEER_IDS: "PEERJS_TRUSTED_PEER_IDS",
    PEERJS_SERVER_HOST: "PEERJS_SERVER_HOST",
    PEERJS_SERVER_PORT: "PEERJS_SERVER_PORT",
    PEERJS_SERVER_PATH: "PEERJS_SERVER_PATH",
    PEERJS_SERVER_SECURE: "PEERJS_SERVER_SECURE",
    PEERJS_PEER_ALIASES: "PEERJS_PEER_ALIASES",
    PEERJS_MY_ALIAS: "PEERJS_MY_ALIAS",
  },
}));

jest.unstable_mockModule("../../../content/message-attachments.js", () => ({
  inferAttachmentMimeType: mockInferAttachmentMimeType,
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: mockReadGroupFileBytes,
}));

jest.unstable_mockModule("./parseStoredStringList.js", () => ({
  parseStoredStringList: mockParseStoredStringList,
}));

const { loadChannelConfigurations } =
  await import("./loadChannelConfigurations.js");

describe("loadChannelConfigurations", () => {
  let mockOrchestrator: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {};
    mockOrchestrator = {
      channelEnabledByType: { telegram: false, imessage: false, peerjs: false },
      loadChannelEnabled: (jest.fn() as any).mockResolvedValue(true),
      loadSecretConfig: (jest.fn() as any).mockResolvedValue("secret"),
      telegram: { configure: jest.fn(), fileReader: null },
      imessage: { configure: jest.fn(), fileReader: null },
      peerjs: { configure: jest.fn() },
    };

    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      const config: Record<string, string> = {
        TELEGRAM_USE_PROXY: "true",
        IMESSAGE_SERVER_URL: "http://imessage  ",
        PEERJS_MY_PEER_ID: " peer1 ",
        PEERJS_SERVER_HOST: " host ",
        PEERJS_SERVER_PORT: " 9000 ",
        PEERJS_SERVER_PATH: " /path ",
        PEERJS_SERVER_SECURE: "false",
        PEERJS_PEER_ALIASES: '{"peer2":"alias2"}',
        PEERJS_MY_ALIAS: " myalias ",
      };
      return config[key] || null;
    });

    mockParseStoredStringList.mockReturnValue(["id1", "id2"]);
    mockInferAttachmentMimeType.mockReturnValue("image/png");
    mockReadGroupFileBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("should configure telegram and imessage correctly", async () => {
    await loadChannelConfigurations(mockOrchestrator, mockDb);

    expect(mockOrchestrator.loadChannelEnabled).toHaveBeenCalledWith(
      mockDb,
      "telegram",
    );
    expect(mockOrchestrator.loadChannelEnabled).toHaveBeenCalledWith(
      mockDb,
      "imessage",
    );
    expect(mockOrchestrator.channelEnabledByType.telegram).toBe(true);
    expect(mockOrchestrator.channelEnabledByType.imessage).toBe(true);

    expect(mockOrchestrator.telegramBotToken).toBe("secret");
    expect(mockOrchestrator.telegramChatIds).toEqual(["id1", "id2"]);
    expect(mockOrchestrator.telegramUseProxy).toBe(true);
    expect(mockOrchestrator.telegram.configure).toHaveBeenCalledWith(
      "secret",
      ["id1", "id2"],
      true,
    );

    expect(mockOrchestrator.imessageServerUrl).toBe("http://imessage");
    expect(mockOrchestrator.imessageApiKey).toBe("secret");
    expect(mockOrchestrator.imessageChatIds).toEqual(["id1", "id2"]);
    expect(mockOrchestrator.imessage.configure).toHaveBeenCalledWith(
      "http://imessage",
      "secret",
      ["id1", "id2"],
    );
  });

  it("should configure peerjs correctly", async () => {
    await loadChannelConfigurations(mockOrchestrator, mockDb);

    expect(mockOrchestrator.channelEnabledByType.peerjs).toBe(true);
    expect(mockOrchestrator.peerjsMyPeerId).toBe("peer1");
    expect(mockOrchestrator.peerjsTrustedPeerIds).toEqual(["id1", "id2"]);
    expect(mockOrchestrator.peerjsMyAlias).toBe("myalias");
    expect(mockOrchestrator.peerjsPeerAliases).toEqual({ peer2: "alias2" });
    expect(mockOrchestrator.peerjsServerHost).toBe("host");
    expect(mockOrchestrator.peerjsServerPort).toBe(9000);
    expect(mockOrchestrator.peerjsServerPath).toBe("/path");
    expect(mockOrchestrator.peerjsServerSecure).toBe(false);

    expect(mockOrchestrator.peerjs.configure).toHaveBeenCalledWith(
      "peer1",
      ["id1", "id2"],
      {
        host: "host",
        port: 9000,
        path: "/path",
        secure: false,
      },
    );
  });

  it("should handle invalid peerjs aliases json", async () => {
    const consoleWarn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      if (key === "PEERJS_PEER_ALIASES") return "{ invalid }";
      return null;
    });

    await loadChannelConfigurations(mockOrchestrator, mockDb);

    expect(consoleWarn).toHaveBeenCalledWith(
      "Failed to parse peerjs_peer_aliases",
      expect.any(Error),
    );
    expect(mockOrchestrator.peerjsPeerAliases).toEqual({});

    consoleWarn.mockRestore();
  });

  it("should provide fileReader that reads file as blob", async () => {
    await loadChannelConfigurations(mockOrchestrator, mockDb);

    const fileReader = mockOrchestrator.telegram.fileReader;
    expect(fileReader).toBeDefined();

    const blob = await fileReader("group1", "test.png");

    expect(mockReadGroupFileBytes).toHaveBeenCalledWith(
      mockDb,
      "group1",
      "test.png",
    );
    expect(mockInferAttachmentMimeType).toHaveBeenCalledWith("test.png");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob!.type).toBe("image/png");

    // Check blob size directly since JSDOM Blob might not have arrayBuffer
    expect(blob!.size).toBe(3);
  });

  it("should provide fileReader that returns null on error", async () => {
    mockReadGroupFileBytes.mockRejectedValue(new Error("File not found"));
    const consoleWarn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    await loadChannelConfigurations(mockOrchestrator, mockDb);

    const fileReader = mockOrchestrator.telegram.fileReader;
    const blob = await fileReader("group1", "test.png");

    expect(blob).toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith(
      "Orchestrator: channel fileReader failed for test.png:",
      expect.any(Error),
    );

    consoleWarn.mockRestore();
  });
});
