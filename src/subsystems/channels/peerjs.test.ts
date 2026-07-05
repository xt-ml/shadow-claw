import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Minimal PeerJS mocks
// ---------------------------------------------------------------------------

// type DataHandler = (data: unknown) => void;
type EventHandler = (...args: any[]) => void;

class MockDataConnection {
  remotePeerId: string;
  peer: string;
  open = true;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(remotePeerId: string) {
    this.remotePeerId = remotePeerId;
    this.peer = remotePeerId;
  }

  send = jest.fn();

  on(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);

    return this;
  }

  emit(event: string, ...args: any[]) {
    (this.handlers.get(event) || []).forEach((h) => h(...args));
  }

  close() {
    this.emit("close");
  }
}

class MockPeer {
  id: string;
  private handlers: Map<string, EventHandler[]> = new Map();
  destroyed = false;

  constructor(id: string, _opts?: unknown) {
    this.id = id;
    // Simulate async "open" event so start() gets our id
    setTimeout(() => this.emit("open", id), 0);
  }

  on(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);

    return this;
  }

  emit(event: string, ...args: any[]) {
    (this.handlers.get(event) || []).forEach((h) => h(...args));
  }

  connect(remotePeerId: string): MockDataConnection {
    const conn = new MockDataConnection(remotePeerId);
    // Simulate open
    setTimeout(() => conn.emit("open"), 0);

    return conn;
  }

  destroy() {
    this.destroyed = true;
    this.emit("disconnected");
  }
}

// Mock the peerjs module
let lastPeerInstance: MockPeer | null = null;

jest.unstable_mockModule("peerjs", () => ({
  Peer: jest.fn<any>().mockImplementation((id: string, opts?: unknown) => {
    lastPeerInstance = new MockPeer(id, opts);

    return lastPeerInstance;
  }),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn(async () => ({})),
}));

jest.unstable_mockModule("../../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: jest.fn(async () => new Uint8Array()),
}));

jest.unstable_mockModule("../../storage/writeGroupFileBytes.js", () => ({
  writeGroupFileBytes: jest.fn(async () => {}),
}));

jest.unstable_mockModule("../../utils/utils.js", () => ({
  computeSha256: jest.fn(async () => "mock-hash"),
}));

const { PeerJsChannel } = await import("./peerjs.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PeerJsChannel", () => {
  beforeEach(() => {
    lastPeerInstance = null;
    jest.clearAllMocks();
  });

  // ----- configure -----

  describe("configure()", () => {
    it("stores myPeerId and trustedPeerIds", () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", ["trusted-1", "trusted-2"]);
      expect(ch.myPeerId).toBe("my-id");
      expect(ch.trustedPeerIds).toEqual(new Set(["trusted-1", "trusted-2"]));
    });

    it("trims peer IDs and filters empties", () => {
      const ch = new PeerJsChannel();
      ch.configure("  my-id  ", ["  a  ", "", "  b  "]);
      expect(ch.myPeerId).toBe("my-id");
      expect(ch.trustedPeerIds).toEqual(new Set(["a", "b"]));
    });

    it("accepts empty trustedPeerIds (allow-all mode)", () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      expect(ch.trustedPeerIds.size).toBe(0);
    });
  });

  // ----- start / stop -----

  describe("start() / stop()", () => {
    it("creates a Peer on start", () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();
      expect(lastPeerInstance).not.toBeNull();
    });

    it("does not create a second Peer when already running", async () => {
      const { Peer } = await import("peerjs");
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();
      ch.start();
      expect(Peer).toHaveBeenCalledTimes(1);
    });

    it("does not start without configure being called first", async () => {
      const { Peer } = await import("peerjs");
      const ch = new PeerJsChannel();
      ch.start(); // no myPeerId set — should be a no-op
      expect(Peer).not.toHaveBeenCalled();
    });

    it("stops and clears state", () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();
      ch.stop();
      expect(lastPeerInstance?.destroyed).toBe(true);
      expect(ch.running).toBe(false);
    });
  });

  // ----- onMessage -----

  describe("onMessage()", () => {
    it("stores the message callback", () => {
      const ch = new PeerJsChannel();
      const cb = jest.fn();
      ch.onMessage(cb);
      expect(ch.messageCallback).toBe(cb);
    });

    it("fires callback on inbound chat message", async () => {
      const ch = new PeerJsChannel();
      const cb = jest.fn();
      ch.onMessage(cb);
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      // Simulate incoming connection
      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      // Simulate inbound chat data
      incomingConn.emit("data", { type: "chat", text: "hello" });

      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: "peer:remote-peer",
          sender: "remote-peer",
          content: "hello",
          channel: "peerjs",
        }),
      );
    });

    it("ignores non-chat messages", async () => {
      const ch = new PeerJsChannel();
      const cb = jest.fn();
      ch.onMessage(cb);
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");
      incomingConn.emit("data", { type: "typing", typing: true });

      expect(cb).not.toHaveBeenCalled();
    });

    it("rejects messages from untrusted peers when trustedPeerIds is set", async () => {
      const ch = new PeerJsChannel();
      const cb = jest.fn();
      ch.onMessage(cb);
      ch.configure("my-id", ["trusted-peer"]);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("unknown-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");
      incomingConn.emit("data", { type: "chat", text: "hello" });

      expect(cb).not.toHaveBeenCalled();
    });

    it("accepts messages from any peer when trustedPeerIds is empty", async () => {
      const ch = new PeerJsChannel();
      const cb = jest.fn();
      ch.onMessage(cb);
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("anyone");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");
      incomingConn.emit("data", { type: "chat", text: "hi" });

      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: "peer:anyone", content: "hi" }),
      );
    });
  });

  // ----- send -----

  describe("send()", () => {
    it("sends a chat message over an open connection", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      // Simulate remote peer connecting to us first (so we have a conn)
      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      await ch.send("peer:remote-peer", "hello world");

      // Find the SendMessage call (skip GetAgentCard)
      const calls = (incomingConn.send as jest.Mock).mock.calls;
      const sendMsgCall = calls.find(
        (c: any[]) => c[0]?.method === "SendMessage",
      );
      expect(sendMsgCall).toBeDefined();
      const envelope = sendMsgCall![0] as any;
      expect(envelope.jsonrpc).toBe("2.0");
      expect(envelope.method).toBe("SendMessage");
      expect(envelope.params.message.role).toBe("ROLE_AGENT");
      expect(envelope.params.message.parts).toEqual([
        { kind: "text", text: "hello world" },
      ]);
    });

    it("strips peer: prefix to get remote peer id", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("abc-123");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      await ch.send("peer:abc-123", "test");

      // Find the SendMessage call (skip GetAgentCard)
      const calls = (incomingConn.send as jest.Mock).mock.calls;
      const sendMsgCall = calls.find(
        (c: any[]) => c[0]?.method === "SendMessage",
      );
      expect(sendMsgCall).toBeDefined();
      const envelope = sendMsgCall![0] as any;
      expect(envelope.jsonrpc).toBe("2.0");
      expect(envelope.method).toBe("SendMessage");
      expect(envelope.params.message.role).toBe("ROLE_AGENT");
      expect(envelope.params.message.parts).toEqual([
        { kind: "text", text: "test" },
      ]);
    });
  });

  // ----- setTyping -----

  describe("setTyping()", () => {
    it("sends a typing message when typing=true", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      ch.setTyping("peer:remote-peer", true);

      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "typing", typing: true }),
      );
    });

    it("sends a typing=false message when typing stops", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      ch.setTyping("peer:remote-peer", false);

      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "typing", typing: false }),
      );
    });
  });

  // ----- isConfigured -----

  describe("isConfigured()", () => {
    it("returns false before configure", () => {
      const ch = new PeerJsChannel();
      expect(ch.isConfigured()).toBe(false);
    });

    it("returns true after configure with a peer id", () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      expect(ch.isConfigured()).toBe(true);
    });
  });
});
