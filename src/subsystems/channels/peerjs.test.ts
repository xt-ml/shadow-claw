import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Minimal PeerJS mocks
// ---------------------------------------------------------------------------

type EventHandler = (...args: any[]) => void;

class MockDataConnection {
  open = true;
  peer: string;
  remotePeerId: string;

  send = jest.fn();
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(remotePeerId: string) {
    this.remotePeerId = remotePeerId;
    this.peer = remotePeerId;
  }

  close() {
    this.emit("close");
  }

  emit(event: string, ...args: any[]) {
    (this.handlers.get(event) || []).forEach((h) => h(...args));
  }

  on(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);

    return this;
  }
}

class MockPeer {
  destroyed = false;
  id: string;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(id: string, _opts?: unknown) {
    this.id = id;
    setTimeout(() => this.emit("open", id), 0);
  }

  connect(remotePeerId: string): MockDataConnection {
    const conn = new MockDataConnection(remotePeerId);
    setTimeout(() => conn.emit("open"), 0);

    return conn;
  }

  destroy() {
    this.destroyed = true;
    this.emit("disconnected");
  }

  emit(event: string, ...args: any[]) {
    (this.handlers.get(event) || []).forEach((h) => h(...args));
  }

  on(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);

    return this;
  }
}

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
  readGroupFileBytes: jest.fn(async () => new Uint8Array([1, 2, 3])),
}));

jest.unstable_mockModule("../../storage/writeGroupFileBytes.js", () => ({
  writeGroupFileBytes: jest.fn(async () => {}),
}));

jest.unstable_mockModule("../../utils/utils.js", () => ({
  computeSha256: jest.fn(async () => "mock-hash"),
}));

const { PeerJsChannel } = await import("./peerjs.js");

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10));
}

describe("PeerJsChannel", () => {
  beforeEach(() => {
    lastPeerInstance = null;
    jest.clearAllMocks();
  });

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

  describe("start() / stop()", () => {
    it("creates a Peer on start", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();
      await new Promise((r) => setTimeout(r, 0));
      expect(lastPeerInstance).not.toBeNull();
    });

    it("does not create a second Peer when already running", async () => {
      const { Peer } = await import("peerjs");
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();
      await new Promise((r) => setTimeout(r, 0));
      ch.start();
      await new Promise((r) => setTimeout(r, 0));
      expect(Peer).toHaveBeenCalledTimes(1);
    });

    it("does not start without configure being called first", async () => {
      const { Peer } = await import("peerjs");
      const ch = new PeerJsChannel();
      ch.start();
      await new Promise((r) => setTimeout(r, 0));
      expect(Peer).not.toHaveBeenCalled();
    });

    it("stops and clears state", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();
      await new Promise((r) => setTimeout(r, 0));
      ch.stop();
      expect(lastPeerInstance?.destroyed).toBe(true);
      expect(ch.running).toBe(false);
    });
  });

  describe("onMessage() and typing callbacks", () => {
    it("stores the message callback and fires on chat message", async () => {
      const ch = new PeerJsChannel();
      const cb = jest.fn();
      ch.onMessage(cb);
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

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

    it("fires onTyping callback when typing event received", async () => {
      const ch = new PeerJsChannel();
      const typingCb = jest.fn();
      ch.onTyping(typingCb);
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      incomingConn.emit("data", { type: "typing", typing: true });

      expect(typingCb).toHaveBeenCalledWith("peer:remote-peer", true);
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

  describe("send() and setTyping()", () => {
    it("sends a chat message over an open connection", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      await ch.send("peer:remote-peer", "hello world");

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

    it("sends a chat message with attachments", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      await ch.send("peer:remote-peer", "check this file", [
        {
          path: "images/test.png",
          mimeType: "image/png",
          size: 3,
        } as any,
      ]);

      const calls = (incomingConn.send as jest.Mock).mock.calls;
      const sendMsgCall = calls.find(
        (c: any[]) => c[0]?.method === "SendMessage",
      );
      expect(sendMsgCall).toBeDefined();
      expect(
        (sendMsgCall![0] as any).params.message.parts.some(
          (p: any) => p.kind === "file",
        ),
      ).toBe(true);
    });

    it("sends typing notifications", async () => {
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

      ch.setTyping("peer:remote-peer", false);
      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "typing", typing: false }),
      );
    });
  });

  describe("A2A JSON-RPC request handling", () => {
    it("responds to GetAgentCard request", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      incomingConn.emit("data", {
        jsonrpc: "2.0",
        id: "req-1",
        method: "GetAgentCard",
      });

      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: "2.0",
          id: "req-1",
          result: expect.objectContaining({
            name: "my-id",
          }),
        }),
      );
    });

    it("responds to unknown method with METHOD_NOT_FOUND", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      incomingConn.emit("data", {
        jsonrpc: "2.0",
        id: "req-unknown",
        method: "NonExistentMethod",
      });

      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: "2.0",
          id: "req-unknown",
          error: expect.objectContaining({
            code: -32601,
          }),
        }),
      );
    });
  });

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

  describe("A2UI & room notification methods", () => {
    it("sends A2UI surface envelopes and A2UI actions", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      // 1. sendA2UI
      await ch.sendA2UI("peer:remote-peer", {
        surfaces: { main: { type: "text", content: "Hello A2UI" } },
      } as any);

      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: "2.0",
          method: "message/send",
          params: expect.objectContaining({
            message: expect.objectContaining({
              role: "agent",
              parts: [
                expect.objectContaining({
                  kind: "a2ui",
                }),
              ],
            }),
          }),
        }),
      );

      // 2. sendA2UIAction
      await ch.sendA2UIAction("peer:remote-peer", {
        surfaceId: "main",
        action: "submit",
        payload: { text: "Clicked" },
      } as any);

      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: "2.0",
          method: "message/send",
          params: expect.objectContaining({
            message: expect.objectContaining({
              role: "user",
              parts: [
                expect.objectContaining({
                  kind: "a2ui-action",
                }),
              ],
            }),
          }),
        }),
      );
    });

    it("sends room notifications and dispatches to handler", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      // 1. sendRoomNotification
      const sent = ch.sendRoomNotification("remote-peer", {
        jsonrpc: "2.0",
        method: "room/join",
        params: { roomId: "room-123" },
      });
      expect(sent).toBe(true);
      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "room/join",
        }),
      );

      // 2. setRoomNotificationHandler & receive notification
      const roomHandler = jest.fn();
      ch.setRoomNotificationHandler(roomHandler);

      incomingConn.emit("data", {
        jsonrpc: "2.0",
        method: "room/message",
        params: { text: "Hello Room" },
      });

      expect(roomHandler).toHaveBeenCalledWith("remote-peer", "room/message", {
        text: "Hello Room",
      });
    });

    it("manages task lifecycle and notifies onTaskComplete", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      const onComplete = jest.fn();
      ch.onTaskComplete(onComplete);

      // Verify task manager creation
      const tm = ch.getTaskManager("remote-peer");
      expect(tm).toBeDefined();

      // Emit terminal task status update from remote peer
      incomingConn.emit("data", {
        jsonrpc: "2.0",
        method: "tasks/statusUpdate",
        params: {
          taskId: "t-1",
          contextId: "c-1",
          status: {
            state: "TASK_STATE_COMPLETED",
          },
        },
      });

      expect(onComplete).toHaveBeenCalledWith("peer:remote-peer");
    });

    it("tracks peer connection status with isPeerConnected", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      expect(ch.isPeerConnected("remote-peer")).toBe(false);

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      expect(ch.isPeerConnected("remote-peer")).toBe(true);

      ch.stop();
      expect(ch.isPeerConnected("remote-peer")).toBe(false);
    });

    it("processes inbound A2A envelopes with file attachments and remapping", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      const messageCallback = jest.fn();
      ch.onMessage(messageCallback);

      // Inbound A2A envelope with text and file part
      incomingConn.emit("data", {
        jsonrpc: "2.0",
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [
              { kind: "text", text: "Here is the report [doc](doc.pdf)" },
              {
                kind: "file",
                name: "doc.pdf",
                mimeType: "application/pdf",
                size: 1024,
              },
            ],
          },
        },
      });

      expect(messageCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: "peer:remote-peer",
          sender: "remote-peer",
          content: "Here is the report [doc](doc.pdf)",
          attachments: [
            expect.objectContaining({
              fileName: "doc.pdf",
              mimeType: "application/pdf",
              size: 1024,
            }),
          ],
        }),
      );
    });

    it("completes active task when present and returns false when absent", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      expect(ch.completeActiveTask("peer:remote-peer")).toBe(false);

      const tm = ch.getTaskManager("remote-peer");
      expect(ch.completeActiveTask("peer:remote-peer")).toBe(false);

      // Create a task
      tm.handleSendMessage({
        message: {
          messageId: "msg-123",
          role: "user" as any,
          parts: [{ text: "do task" }],
        },
      });

      expect(ch.completeActiveTask("peer:remote-peer")).toBe(true);
    });

    it("handles connectPeer, setTyping, and room notifications", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      ch.connectPeer("remote-peer-2");
      expect(ch.isPeerConnected("remote-peer-2")).toBe(true);

      ch.setTyping("peer:remote-peer-2", true);
      const conn = (ch as any).connections.get("remote-peer-2");
      expect(conn.send).toHaveBeenCalledWith({ type: "typing", typing: true });

      // sendRoomNotification with open connection
      const sent = ch.sendRoomNotification("remote-peer-2", {
        jsonrpc: "2.0",
        method: "room/custom",
        params: { ok: true },
      });
      expect(sent).toBe(true);

      // sendRoomNotification when connection opens later
      const freshConn = new MockDataConnection("remote-peer-3");
      freshConn.open = false;
      (lastPeerInstance as any).connect = jest.fn(() => freshConn);

      const queued = ch.sendRoomNotification("remote-peer-3", {
        jsonrpc: "2.0",
        method: "room/queued",
        params: {},
      });
      expect(queued).toBe(true);

      freshConn.open = true;
      freshConn.emit("open");
      await flushMicrotasks();
      expect(freshConn.send).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        method: "room/queued",
        params: {},
      });
    });

    it("tracks peerjs-dc-handle-chunk event on globalThis", async () => {
      new PeerJsChannel();
      const customEvent = new CustomEvent("peerjs-dc-handle-chunk", {
        detail: {
          chunkInfo: { count: 1, total: 3 },
        },
      });
      globalThis.dispatchEvent(customEvent);

      const { transferProgressSignal } = await import("./peerjs.js");
      expect(transferProgressSignal.get()).toEqual({
        count: 2,
        total: 3,
        direction: "receive",
      });
    });

    it("sends file attachments and markdown links over DataConnection", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer-files");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      await ch.send("peer:remote-peer-files", "See [notes](notes.txt)", [
        { path: "image.png", mimeType: "image/png" } as any,
      ]);

      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "__file_header",
          name: "image.png",
          mimeType: "image/png",
        }),
      );
    });

    it("sends A2UI and A2UIAction envelopes", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer-a2ui");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      // 1. sendA2UI
      await ch.sendA2UI("peer:remote-peer-a2ui", {
        surfaceId: "s1",
        components: [],
      } as any);
      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "message/send",
        }),
      );

      // 2. sendA2UIAction
      await ch.sendA2UIAction("peer:remote-peer-a2ui", {
        actionId: "a1",
        surfaceId: "s1",
        componentId: "c1",
      } as any);
      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "message/send",
        }),
      );
    });

    it("handles inbound A2A JSON-RPC requests, errors, and responses", async () => {
      const ch = new PeerJsChannel();
      ch.configure("my-id", []);
      ch.start();

      await flushMicrotasks();

      const incomingConn = new MockDataConnection("remote-peer-rpc");
      lastPeerInstance!.emit("connection", incomingConn);
      incomingConn.emit("open");

      // 1. Unknown method
      incomingConn.emit("data", {
        jsonrpc: "2.0",
        id: "req-1",
        method: "unknown/method",
        params: {},
      });
      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "req-1",
          error: expect.objectContaining({ code: -32601 }),
        }),
      );

      // 2. GetTask missing params
      incomingConn.emit("data", {
        jsonrpc: "2.0",
        id: "req-2",
        method: "GetTask",
        params: {},
      });
      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "req-2",
          error: expect.objectContaining({ code: -32602 }),
        }),
      );

      // 3. CancelTask missing params
      incomingConn.emit("data", {
        jsonrpc: "2.0",
        id: "req-3",
        method: "CancelTask",
        params: {},
      });
      expect(incomingConn.send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "req-3",
          error: expect.objectContaining({ code: -32602 }),
        }),
      );

      // 4. Pending request resolution
      const resolveFn = jest.fn();
      (ch as any)._pendingRequests.set("req-test", {
        resolve: resolveFn,
        reject: jest.fn(),
        timer: setTimeout(() => {}, 10000),
      });
      incomingConn.emit("data", {
        jsonrpc: "2.0",
        id: "req-test",
        result: { ok: true },
      });
      expect(resolveFn).toHaveBeenCalledWith(
        expect.objectContaining({ result: { ok: true } }),
      );
    });
  });
});
