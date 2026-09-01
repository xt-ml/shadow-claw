import { jest } from "@jest/globals";
import { ServerPeer } from "./server-peer.js";

describe("ServerPeer", () => {
  it("initializes ServerPeer with options and handlers", () => {
    const mockHandler = jest.fn();
    const peer = new ServerPeer({
      peerId: "test-server-peer",
      host: "127.0.0.1",
      port: 8888,
      handlers: {
        "custom-action": mockHandler,
      },
    });

    expect(peer.peerId).toBe("test-server-peer");
    expect(peer.isOpen).toBe(false);
    expect(peer.getConnectedPeers()).toEqual([]);
  });

  it("handles incoming command:execute and command:result payloads", async () => {
    const mockHandler = jest.fn(async (args: any) => ({
      ok: true,
      echo: args.text,
    }));
    const peer = new ServerPeer({
      peerId: "test-server-peer",
      handlers: {
        "echo-test": mockHandler,
      },
    });

    const sentMessages: any[] = [];
    const mockConn = {
      peer: "remote-client-peer",
      send: (data: any) => sentMessages.push(data),
    };

    // Simulate incoming command:execute
    await (peer as any)._handleData("remote-client-peer", mockConn, {
      id: "req-1",
      type: "command:execute",
      payload: {
        commandId: "cmd-1",
        action: "echo-test",
        args: { text: "hello peer" },
      },
    });

    expect(mockHandler).toHaveBeenCalledWith({ text: "hello peer" });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].type).toBe("command:result");
    expect(sentMessages[0].payload.success).toBe(true);
    expect(sentMessages[0].payload.data).toEqual({
      ok: true,
      echo: "hello peer",
    });
  });

  it("handles unknown action error", async () => {
    const peer = new ServerPeer({
      peerId: "test-server-peer",
    });

    const sentMessages: any[] = [];
    const mockConn = {
      peer: "remote-client-peer",
      send: (data: any) => sentMessages.push(data),
    };

    await (peer as any)._handleData("remote-client-peer", mockConn, {
      id: "req-2",
      type: "command:execute",
      payload: {
        commandId: "cmd-2",
        action: "unregistered-action",
        args: {},
      },
    });

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].type).toBe("command:result");
    expect(sentMessages[0].payload.success).toBe(false);
    expect(sentMessages[0].payload.error).toContain("Unknown action");
  });
});
