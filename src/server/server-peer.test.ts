import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";

class MockConn extends EventEmitter {
  public peer: string;
  public open = false;
  public sent: any[] = [];

  constructor(peer: string) {
    super();
    this.peer = peer;
  }

  send(data: any) {
    this.sent.push(data);
  }

  close() {
    this.open = false;
    this.emit("close");
  }
}

class MockPeer extends EventEmitter {
  public id: string;
  public options: any;
  public connections: MockConn[] = [];

  constructor(id: string, options: any) {
    super();
    this.id = id;
    this.options = options;
  }

  connect(remotePeerId: string) {
    const conn = new MockConn(remotePeerId);
    this.connections.push(conn);
    return conn;
  }

  destroy() {
    this.emit("close");
  }
}

let mockPeerInstance: MockPeer | null = null;
const mockPeerConstructor = jest.fn((id: string, opts: any) => {
  mockPeerInstance = new MockPeer(id, opts);
  return mockPeerInstance;
});

jest.unstable_mockModule("./webrtc.js", () => ({
  getPeerClass: jest.fn(async () => mockPeerConstructor),
}));

const { ServerPeer } = await import("./server-peer.js");

describe("ServerPeer", () => {
  beforeEach(() => {
    mockPeerInstance = null;
    jest.clearAllMocks();
  });

  it("initializes ServerPeer with options and handlers", () => {
    const mockHandler = jest.fn();
    const peer = new ServerPeer({
      peerId: "test-server-peer",
      host: "127.0.0.1",
      port: 8888,
      verbose: true,
      handlers: {
        "custom-action": mockHandler,
      },
    });

    expect(peer.peerId).toBe("test-server-peer");
    expect(peer.isOpen).toBe(false);
    expect(peer.getConnectedPeers()).toEqual([]);
  });

  it("starts successfully and handles peer lifecycle", async () => {
    const peer = new ServerPeer({
      peerId: "my-peer",
      verbose: true,
    });

    const startPromise = peer.start();
    await new Promise((r) => setTimeout(r, 10));
    expect(mockPeerInstance).toBeDefined();

    mockPeerInstance!.emit("open", "my-peer");
    const id = await startPromise;
    expect(id).toBe("my-peer");
    expect(peer.isOpen).toBe(true);

    // Incoming connection from remote peer
    const incomingConn = new MockConn("remote-client");
    mockPeerInstance!.emit("connection", incomingConn);

    incomingConn.open = true;
    incomingConn.emit("open");
    expect(peer.isPeerConnected("remote-client")).toBe(true);
    expect(peer.getConnectedPeers()).toEqual(["remote-client"]);

    // Connection error and close
    incomingConn.emit("error", new Error("DataChannel drop"));
    incomingConn.emit("close");
    expect(peer.isPeerConnected("remote-client")).toBe(false);

    // Peer close
    mockPeerInstance!.emit("close");
    expect(peer.isOpen).toBe(false);
  });

  it("handles start error before open", async () => {
    const peer = new ServerPeer({ peerId: "err-peer" });
    const startPromise = peer.start();
    await new Promise((r) => setTimeout(r, 10));

    mockPeerInstance!.emit("error", new Error("Signaling unreachable"));
    await expect(startPromise).rejects.toThrow("Signaling unreachable");
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

    // Simulate string rawData with JSON parsing
    await (peer as any)._handleData(
      "remote-client-peer",
      mockConn,
      JSON.stringify({
        id: "req-1",
        type: "command:execute",
        payload: {
          commandId: "cmd-1",
          action: "echo-test",
          args: { text: "hello peer" },
        },
      }),
    );

    expect(mockHandler).toHaveBeenCalledWith({ text: "hello peer" });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].type).toBe("command:result");
    expect(sentMessages[0].payload.success).toBe(true);
    expect(sentMessages[0].payload.data).toEqual({
      ok: true,
      echo: "hello peer",
    });
  });

  it("handles handler exception during command:execute", async () => {
    const mockHandler = jest.fn(async () => {
      throw new Error("Action failure");
    });
    const peer = new ServerPeer({
      peerId: "test-server-peer",
      handlers: {
        "failing-action": mockHandler,
      },
    });

    const sentMessages: any[] = [];
    const mockConn = {
      peer: "remote-client-peer",
      send: (data: any) => sentMessages.push(data),
    };

    await (peer as any)._handleData("remote-client-peer", mockConn, {
      id: "req-fail",
      type: "command:execute",
      payload: {
        commandId: "cmd-fail",
        action: "failing-action",
        args: {},
      },
    });

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].payload.success).toBe(false);
    expect(sentMessages[0].payload.error).toBe("Action failure");
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

  it("ignores invalid or non-object rawData", async () => {
    const peer = new ServerPeer();
    const mockConn = { send: jest.fn() };

    await (peer as any)._handleData("remote", mockConn, "invalid-json{");
    await (peer as any)._handleData("remote", mockConn, null);
    await (peer as any)._handleData("remote", mockConn, 123);
    expect(mockConn.send).not.toHaveBeenCalled();
  });

  it("sends command to connected peer and resolves on result", async () => {
    const peer = new ServerPeer({ peerId: "server-sender" });
    const startPromise = peer.start();
    await new Promise((r) => setTimeout(r, 10));
    mockPeerInstance!.emit("open", "server-sender");
    await startPromise;

    const mockConn = new MockConn("target-peer");
    mockConn.open = true;
    (peer as any)._connections.set("target-peer", mockConn);

    const sendPromise = peer.sendCommand("target-peer", "ping", { val: 1 });
    expect(mockConn.sent).toHaveLength(1);
    const sentMsg = mockConn.sent[0];
    const cmdId = sentMsg.payload.commandId;

    // Simulate incoming command:result from remote peer
    await (peer as any)._handleData("target-peer", mockConn, {
      type: "command:result",
      payload: {
        commandId: cmdId,
        success: true,
        data: "pong",
      },
    });

    const result = await sendPromise;
    expect(result.success).toBe(true);
    expect(result.data).toBe("pong");
  });

  it("throws when sendCommand is called before peer is started", async () => {
    const peer = new ServerPeer();
    await expect(peer.sendCommand("target", "action")).rejects.toThrow(
      "Server peer is not running",
    );
  });

  it("connects to remote peer if not already connected when sending command", async () => {
    const peer = new ServerPeer({ peerId: "server-sender" });
    const startPromise = peer.start();
    await new Promise((r) => setTimeout(r, 10));
    mockPeerInstance!.emit("open", "server-sender");
    await startPromise;

    const sendPromise = peer.sendCommand("new-remote", "fetch-data");
    const createdConn = mockPeerInstance!.connections[0];
    expect(createdConn).toBeDefined();

    createdConn.open = true;
    createdConn.emit("open");
    await new Promise((r) => setTimeout(r, 10));

    const sentMsg = createdConn.sent[0];
    await (peer as any)._handleData("new-remote", createdConn, {
      type: "command:result",
      payload: {
        commandId: sentMsg.payload.commandId,
        success: true,
      },
    });

    const res = await sendPromise;
    expect(res.success).toBe(true);
  });

  it("closes peer and terminates pending commands and connections", async () => {
    const peer = new ServerPeer({ peerId: "server-close" });
    const startPromise = peer.start();
    await new Promise((r) => setTimeout(r, 10));
    mockPeerInstance!.emit("open", "server-close");
    await startPromise;

    const mockConn = new MockConn("peer-1");
    mockConn.open = true;
    (peer as any)._connections.set("peer-1", mockConn);

    const pendingPromise = peer.sendCommand("peer-1", "long-job", {}, 10_000);
    peer.close();

    await expect(pendingPromise).rejects.toThrow("Server peer closed");
    expect(peer.isOpen).toBe(false);
    expect(peer.getConnectedPeers()).toHaveLength(0);
  });
});
