import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockSendCommand = jest.fn() as any;
const mockListClients = jest.fn() as any;

jest.unstable_mockModule("../../../cli/utils/control-client.js", () => {
  return {
    CliControlClient: class MockCliControlClient {
      sendCommand = mockSendCommand;
      listClients = mockListClients;
    },
  };
});

// Import native-peer-client to register default factory
await import("./native-peer-client.js");
const { executePromptPeer, executeListPeers, setPeerClientFactory } =
  await import("./prompt-peer.js");

describe("prompt_peer and list_peers tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default factory
    setPeerClientFactory(() => ({
      sendCommand: mockSendCommand,
      listClients: mockListClients,
    }));
  });

  describe("executePromptPeer", () => {
    it("returns error when peer_id is missing", async () => {
      const res = await executePromptPeer(
        {} as any,
        { prompt: "hello" },
        "server:main",
      );
      expect(res).toContain("Error: prompt_peer requires a valid peer_id");
    });

    it("returns error when prompt is missing", async () => {
      const res = await executePromptPeer(
        {} as any,
        { peer_id: "peer-123" },
        "server:main",
      );
      expect(res).toContain("Error: prompt_peer requires a non-empty prompt");
    });

    it("returns error when client is not configured", async () => {
      setPeerClientFactory(null);
      const prevGlobal = (globalThis as any).__peerClientFactory;
      (globalThis as any).__peerClientFactory = null;
      try {
        const res = await executePromptPeer(
          {} as any,
          { peer_id: "peer-123", prompt: "hello" },
          "server:main",
        );
        expect(res).toContain(
          "Error: prompt_peer is currently only supported in headless CLI mode",
        );
      } finally {
        (globalThis as any).__peerClientFactory = prevGlobal;
      }
    });

    it("sends prompt to target peer and returns the response", async () => {
      mockSendCommand.mockResolvedValueOnce({
        success: true,
        data: { reply: "Here is the weather forecast for Chicago." },
      });

      const res = await executePromptPeer(
        {} as any,
        { peer_id: "peer-weather", prompt: "What is the weather?" },
        "server:main",
      );

      expect(mockSendCommand).toHaveBeenCalledWith(
        "peer-weather",
        "send-message",
        expect.objectContaining({ text: "What is the weather?" }),
        120000,
      );
      expect(res).toBe("Here is the weather forecast for Chicago.");
    });

    it("handles error response from remote peer", async () => {
      mockSendCommand.mockResolvedValueOnce({
        success: false,
        error: "Peer is offline or busy",
      });

      const res = await executePromptPeer(
        {} as any,
        { peer_id: "peer-offline", prompt: "Ping" },
        "server:main",
      );

      expect(res).toContain("Error from peer: Peer is offline or busy");
    });
  });

  describe("executeListPeers", () => {
    it("returns error when client is not configured", async () => {
      setPeerClientFactory(null);
      const prevGlobal = (globalThis as any).__peerClientFactory;
      (globalThis as any).__peerClientFactory = null;
      try {
        const res = await executeListPeers({} as any, {}, "server:main");
        expect(res).toContain(
          "Error: list_peers is currently only supported in headless CLI mode",
        );
      } finally {
        (globalThis as any).__peerClientFactory = prevGlobal;
      }
    });

    it("lists connected peers", async () => {
      mockListClients.mockResolvedValueOnce([
        { clientId: "peer-1", deviceLabel: "Agent Alpha" },
        { clientId: "peer-2", deviceLabel: "Agent Beta" },
      ]);

      const res = await executeListPeers({} as any, {}, "server:main");
      expect(res).toContain("peer-1");
      expect(res).toContain("Agent Alpha");
      expect(res).toContain("peer-2");
    });

    it("returns friendly message when no peers are connected", async () => {
      mockListClients.mockResolvedValueOnce([]);

      const res = await executeListPeers({} as any, {}, "server:main");
      expect(res).toContain("No connected peers found");
    });
  });
});
