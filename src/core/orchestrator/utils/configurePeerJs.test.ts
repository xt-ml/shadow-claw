import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockSetConfig = jest.fn() as any;
const mockNormalizeStringList = jest.fn() as any;

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("./normalizeStringList.js", () => ({
  normalizeStringList: mockNormalizeStringList,
}));

jest.unstable_mockModule("../../../config/config.js", () => ({
  CONFIG_KEYS: {
    PEERJS_MY_PEER_ID: "PEERJS_MY_PEER_ID",
    PEERJS_TRUSTED_PEER_IDS: "PEERJS_TRUSTED_PEER_IDS",
    PEERJS_SERVER_HOST: "PEERJS_SERVER_HOST",
    PEERJS_SERVER_PORT: "PEERJS_SERVER_PORT",
    PEERJS_SERVER_PATH: "PEERJS_SERVER_PATH",
    PEERJS_SERVER_SECURE: "PEERJS_SERVER_SECURE",
  },
}));

const { configurePeerJs } = await import("./configurePeerJs.js");

describe("configurePeerJs", () => {
  let mockOrchestrator: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {};
    mockOrchestrator = {
      peerjs: {
        stop: jest.fn(),
        configure: jest.fn(),
        start: jest.fn(),
      },
      getChannelEnabled: jest.fn(),
    };

    mockNormalizeStringList.mockReturnValue(["trusted-1", "trusted-2"]);
  });

  it("should normalize and set peerjs configuration", async () => {
    mockOrchestrator.getChannelEnabled.mockReturnValue(true);

    await configurePeerJs(
      mockOrchestrator,
      mockDb,
      " my-peer ",
      ["trusted-1", "trusted-2"],
      " host.com ",
      9000.5,
      " /path ",
      false,
    );

    expect(mockOrchestrator.peerjsMyPeerId).toBe("my-peer");
    expect(mockOrchestrator.peerjsTrustedPeerIds).toEqual([
      "trusted-1",
      "trusted-2",
    ]);
    expect(mockOrchestrator.peerjsServerHost).toBe("host.com");
    expect(mockOrchestrator.peerjsServerPort).toBe(9000);
    expect(mockOrchestrator.peerjsServerPath).toBe("/path");
    expect(mockOrchestrator.peerjsServerSecure).toBe(false);

    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_MY_PEER_ID",
      "my-peer",
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_TRUSTED_PEER_IDS",
      JSON.stringify(["trusted-1", "trusted-2"]),
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_SERVER_HOST",
      "host.com",
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_SERVER_PORT",
      "9000",
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_SERVER_PATH",
      "/path",
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_SERVER_SECURE",
      "false",
    );

    expect(mockOrchestrator.peerjs.stop).toHaveBeenCalled();
    expect(mockOrchestrator.peerjs.configure).toHaveBeenCalledWith(
      "my-peer",
      ["trusted-1", "trusted-2"],
      {
        host: "host.com",
        path: "/path",
        port: 9000,
        secure: false,
      },
    );
    expect(mockOrchestrator.peerjs.start).toHaveBeenCalled();
  });

  it("should handle empty server host and defaults", async () => {
    mockOrchestrator.getChannelEnabled.mockReturnValue(false);

    await configurePeerJs(mockOrchestrator, mockDb, "", []);

    expect(mockOrchestrator.peerjsServerHost).toBe("");
    expect(mockOrchestrator.peerjsServerPort).toBe(0);
    expect(mockOrchestrator.peerjsServerPath).toBe("");
    expect(mockOrchestrator.peerjsServerSecure).toBe(true);

    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_SERVER_PORT",
      "",
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      mockDb,
      "PEERJS_SERVER_SECURE",
      "true",
    );

    expect(mockOrchestrator.peerjs.configure).toHaveBeenCalledWith(
      "",
      ["trusted-1", "trusted-2"],
      {},
    );
    expect(mockOrchestrator.peerjs.start).not.toHaveBeenCalled();
  });

  it("should not start peerjs if channel is disabled", async () => {
    mockOrchestrator.getChannelEnabled.mockReturnValue(false);

    await configurePeerJs(mockOrchestrator, mockDb, "my-peer", []);

    expect(mockOrchestrator.peerjs.start).not.toHaveBeenCalled();
  });

  it("should not start peerjs if peer id is empty", async () => {
    mockOrchestrator.getChannelEnabled.mockReturnValue(true);

    await configurePeerJs(mockOrchestrator, mockDb, "  ", []);

    expect(mockOrchestrator.peerjs.start).not.toHaveBeenCalled();
  });
});
