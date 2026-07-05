/**
 * Tests for PeerJS A2UI wire-protocol extensions:
 *   - sendA2UI() constructs a valid kind:"a2ui" A2A envelope
 *   - sendA2UIAction() constructs a valid kind:"a2ui-action" envelope
 *   - _processInboundA2AEnvelope() collects kind:"a2ui" parts into a2uiEnvelopes
 *   - _processInboundA2AEnvelope() collects kind:"a2ui-action" parts into a2uiAction
 *   - Pure-A2UI messages (no text/file) trigger the messageCallback
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Minimal PeerJS mocks — matches pattern from peerjs.test.ts
// ---------------------------------------------------------------------------

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
    setTimeout(() => conn.emit("open"), 0);

    return conn;
  }

  destroy() {
    this.destroyed = true;
    this.emit("disconnected");
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
  return new Promise((r) => setTimeout(r, 20));
}

/** Wire up a channel with a simulated incoming connection */
async function setupConnectedChannel() {
  const ch = new PeerJsChannel();
  ch.configure("my-id", []);
  ch.start();

  await flushMicrotasks(); // wait for peer "open" event

  const conn = new MockDataConnection("remote-peer");
  lastPeerInstance!.emit("connection", conn);
  conn.emit("open");

  return { ch, conn };
}

// ---------------------------------------------------------------------------
// sendA2UI
// ---------------------------------------------------------------------------

describe("PeerJsChannel.sendA2UI", () => {
  beforeEach(() => {
    lastPeerInstance = null;
    jest.clearAllMocks();
  });

  it("sends a JSON-RPC message/send envelope with kind:'a2ui' part", async () => {
    const { ch, conn } = await setupConnectedChannel();

    const envelope = {
      type: "createSurface" as const,
      surfaceId: "test-surface",
      catalogId:
        "https://a2ui.org/specification/v1_0/catalogs/minimal/catalog.json" as const,
      rootComponentId: "root",
      components: {
        root: { id: "root", component: "Text" as const, text: "Hello" },
      },
    };

    await ch.sendA2UI("peer:remote-peer", envelope);

    expect(conn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: "2.0",
        method: "message/send",
        params: expect.objectContaining({
          message: expect.objectContaining({
            role: "agent",
            parts: [{ kind: "a2ui", envelope }],
          }),
        }),
      }),
    );
  });

  it("uses agent role in the envelope", async () => {
    const { ch, conn } = await setupConnectedChannel();

    await ch.sendA2UI("peer:remote-peer", {
      type: "deleteSurface",
      surfaceId: "s1",
    });

    const calls = (conn.send as jest.Mock).mock.calls;
    const callArg = calls[calls.length - 1][0] as any;
    expect(callArg.params.message.role).toBe("agent");
  });
});

// ---------------------------------------------------------------------------
// sendA2UIAction
// ---------------------------------------------------------------------------

describe("PeerJsChannel.sendA2UIAction", () => {
  beforeEach(() => {
    lastPeerInstance = null;
    jest.clearAllMocks();
  });

  it("sends a JSON-RPC message/send envelope with kind:'a2ui-action' part", async () => {
    const { ch, conn } = await setupConnectedChannel();

    const action = {
      type: "a2ui-action" as const,
      surfaceId: "test-surface",
      actionId: "submit",
      dataModel: { name: "Alice" },
    };

    await ch.sendA2UIAction("peer:remote-peer", action);

    expect(conn.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: "2.0",
        method: "message/send",
        params: expect.objectContaining({
          message: expect.objectContaining({
            role: "user",
            parts: [{ kind: "a2ui-action", action }],
          }),
        }),
      }),
    );
  });

  it("uses user role in the action envelope", async () => {
    const { ch, conn } = await setupConnectedChannel();

    await ch.sendA2UIAction("peer:remote-peer", {
      type: "a2ui-action",
      surfaceId: "s1",
      actionId: "submit",
      dataModel: {},
    });

    const calls = (conn.send as jest.Mock).mock.calls;
    const callArg = calls[calls.length - 1][0] as any;
    expect(callArg.params.message.role).toBe("user");
  });
});

// ---------------------------------------------------------------------------
// Inbound kind:"a2ui"
// ---------------------------------------------------------------------------

describe("PeerJsChannel inbound kind:'a2ui'", () => {
  beforeEach(() => {
    lastPeerInstance = null;
    jest.clearAllMocks();
  });

  it("collects a2ui parts and fires messageCallback with a2uiEnvelopes", async () => {
    const { ch, conn } = await setupConnectedChannel();

    const envelope = { type: "deleteSurface" as const, surfaceId: "s1" };
    let received: any = null;
    ch.onMessage((msg) => {
      received = msg;
    });

    conn.emit("data", {
      jsonrpc: "2.0",
      method: "message/send",
      id: "abc",
      params: {
        message: {
          role: "agent",
          parts: [{ kind: "a2ui", envelope }],
        },
      },
    });

    await flushMicrotasks();

    expect(received).not.toBeNull();
    expect(received.a2uiEnvelopes).toHaveLength(1);
    expect(received.a2uiEnvelopes[0]).toEqual(envelope);
    expect(received.groupId).toBe("peer:remote-peer");
  });

  it("fires messageCallback for pure-A2UI messages (no text or file)", async () => {
    const { ch, conn } = await setupConnectedChannel();

    let callCount = 0;
    ch.onMessage(() => {
      callCount++;
    });

    conn.emit("data", {
      jsonrpc: "2.0",
      method: "message/send",
      id: "abc2",
      params: {
        message: {
          role: "agent",
          parts: [
            {
              kind: "a2ui",
              envelope: { type: "deleteSurface", surfaceId: "s2" },
            },
          ],
        },
      },
    });

    await flushMicrotasks();
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Inbound kind:"a2ui-action"
// ---------------------------------------------------------------------------

describe("PeerJsChannel inbound kind:'a2ui-action'", () => {
  beforeEach(() => {
    lastPeerInstance = null;
    jest.clearAllMocks();
  });

  it("collects a2ui-action part and fires messageCallback with a2uiAction", async () => {
    const { ch, conn } = await setupConnectedChannel();

    const action = {
      type: "a2ui-action" as const,
      surfaceId: "s3",
      actionId: "submit",
      dataModel: { email: "user@example.com" },
    };

    let received: any = null;
    ch.onMessage((msg) => {
      received = msg;
    });

    conn.emit("data", {
      jsonrpc: "2.0",
      method: "message/send",
      id: "xyz",
      params: {
        message: {
          role: "user",
          parts: [{ kind: "a2ui-action", action }],
        },
      },
    });

    await flushMicrotasks();

    expect(received).not.toBeNull();
    expect(received.a2uiAction).toEqual(action);
    expect(received.groupId).toBe("peer:remote-peer");
  });
});
