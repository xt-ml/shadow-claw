import { RoomManager } from "./room-manager.js";
import type { RoomTransport } from "./room-manager.js";
import { ROOM_METHOD } from "./peer-protocol.js";
import type {
  A2AJsonRpcNotification,
  RoomA2UIEnvelope,
  RoomA2UIActionEnvelope,
  RoomMessageEnvelope,
  RoomRosterPayload,
} from "./peer-protocol.js";
import type { InboundMessage, RoomMember, RoomMeta } from "./types.js";
import type { A2UIAction, A2UIEnvelope } from "../../ui/a2ui.js";
import { A2UI_MINIMAL_CATALOG_ID } from "../../ui/a2ui.js";

interface Sent {
  peerId: string;
  note: A2AJsonRpcNotification;
}

class FakeTransport implements RoomTransport {
  connectCalls: string[] = [];
  connected = new Set<string>();
  myPeerId: string;
  sent: Sent[] = [];

  constructor(myPeerId: string, connected: string[] = []) {
    this.myPeerId = myPeerId;
    this.connected = new Set(connected);
  }

  /** Filter sent notifications by method. */
  byMethod(method: string): Sent[] {
    return this.sent.filter((s) => s.note.method === method);
  }

  connectToPeer(peerId: string): void {
    this.connectCalls.push(peerId);
  }

  isConnected(peerId: string): boolean {
    return this.connected.has(peerId);
  }

  sendToPeer(peerId: string, note: A2AJsonRpcNotification): boolean {
    this.sent.push({ peerId, note });

    return true;
  }
}

function member(peerId: string, kind: "human" | "agent" = "human"): RoomMember {
  return { peerId, alias: peerId, kind };
}

function makeManager(
  myPeerId: string,
  connected: string[] = [],
  overrides: Partial<{
    onMessage: (m: InboundMessage) => void;
    persistRoom: (r: RoomMeta) => void;
    removeRoom: (id: string) => void;
    onInvite: (i: any) => void;
  }> = {},
) {
  const transport = new FakeTransport(myPeerId, connected);
  const messages: InboundMessage[] = [];
  const manager = new RoomManager({
    transport,
    getLocalMember: () => member(myPeerId, "agent"),
    onMessage: overrides.onMessage ?? ((m) => messages.push(m)),
    onInvite: overrides.onInvite,
    persistRoom: overrides.persistRoom,
    removeRoom: overrides.removeRoom,
  });

  return { manager, transport, messages };
}

describe("createRoom", () => {
  it("creates a room hosted locally with self as the only member", () => {
    const persisted: RoomMeta[] = [];
    const { manager, transport } = makeManager("host", [], {
      persistRoom: (r) => persisted.push(r),
    });
    const room = manager.createRoom("My Room");

    expect(room.hostPeerId).toBe("host");
    expect(room.members.map((x) => x.peerId)).toEqual(["host"]);
    expect(manager.isHost(room.roomId)).toBe(true);
    expect(persisted).toHaveLength(1);
    expect(transport.sent).toHaveLength(0);
  });
});

describe("joinRoom", () => {
  it("sends a join request to the host and connects", () => {
    const { manager, transport } = makeManager("bob");
    manager.joinRoom("r1", "host", "Room One");

    expect(transport.connectCalls).toContain("host");
    const joins = transport.byMethod(ROOM_METHOD.JOIN);
    expect(joins).toHaveLength(1);
    expect(joins[0].peerId).toBe("host");
    expect((joins[0].note.params as any).member.peerId).toBe("bob");
  });
});

describe("host join handling", () => {
  it("adds the member and broadcasts the roster to all members", () => {
    const { manager, transport } = makeManager("host", ["bob", "carol"]);
    const room = manager.createRoom("Room");
    // carol is already a member via a prior join
    manager.handleNotification("carol", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("carol"),
    });
    transport.sent = [];

    manager.handleNotification("bob", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("bob"),
    });

    const updated = manager.get(room.roomId)!;
    expect(updated.members.map((m) => m.peerId).sort()).toEqual([
      "bob",
      "carol",
      "host",
    ]);

    // Roster broadcast to both bob and carol (not host).
    const rosters = transport.byMethod(ROOM_METHOD.ROSTER);
    const targets = rosters.map((r) => r.peerId).sort();
    expect(targets).toEqual(["bob", "carol"]);
  });

  it("ignores join requests for rooms it does not host", () => {
    const { manager } = makeManager("bob");
    manager.joinRoom("r1", "host", "Room");
    manager.handleNotification("carol", ROOM_METHOD.JOIN, {
      roomId: "r1",
      member: member("carol"),
    });
    // bob is not the host, roster unchanged (host + self provisional)
    expect(
      manager.get("r1")!.members.find((m) => m.peerId === "carol"),
    ).toBeUndefined();
  });
});

describe("roster handling (member)", () => {
  it("replaces the local roster from a host roster notification", () => {
    const { manager } = makeManager("bob");
    manager.joinRoom("r1", "host", "Room");

    const payload: RoomRosterPayload = {
      roomId: "r1",
      name: "Room",
      hostPeerId: "host",
      members: [member("host", "agent"), member("bob"), member("carol")],
    };
    manager.handleNotification("host", ROOM_METHOD.ROSTER, payload);

    expect(
      manager
        .get("r1")!
        .members.map((m) => m.peerId)
        .sort(),
    ).toEqual(["bob", "carol", "host"]);
  });
});

describe("broadcast (mesh)", () => {
  it("delivers a room/message directly to connected members", () => {
    const { manager, transport } = makeManager("host", ["bob", "carol"]);
    const room = manager.createRoom("Room");
    manager.handleNotification("bob", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("bob"),
    });
    manager.handleNotification("carol", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("carol"),
    });
    transport.sent = [];

    manager.broadcast(room.roomId, "hello room");

    const msgs = transport.byMethod(ROOM_METHOD.MESSAGE);
    expect(msgs.map((m) => m.peerId).sort()).toEqual(["bob", "carol"]);
    expect((msgs[0].note.params as RoomMessageEnvelope).text).toBe(
      "hello room",
    );
  });
});

describe("broadcast (host relay fallback)", () => {
  it("relays via host when a member is not directly connected", () => {
    // bob is a member, connected to host but NOT to carol.
    const { manager, transport } = makeManager("bob", ["host"]);
    manager.joinRoom("r1", "host", "Room");
    manager.handleNotification("host", ROOM_METHOD.ROSTER, {
      roomId: "r1",
      name: "Room",
      hostPeerId: "host",
      members: [member("host", "agent"), member("bob"), member("carol")],
    });
    transport.sent = [];

    manager.broadcast("r1", "hi");

    // Direct message to host (connected).
    const direct = transport.byMethod(ROOM_METHOD.MESSAGE);
    expect(direct.map((m) => m.peerId)).toEqual(["host"]);

    // carol is reached via a relay through the host.
    const relays = transport.byMethod(ROOM_METHOD.RELAY);
    expect(relays).toHaveLength(1);
    expect(relays[0].peerId).toBe("host");
    const relayPayload = relays[0].note.params as any;
    expect(relayPayload.targetPeerId).toBe("carol");
    expect(relayPayload.inner.method).toBe(ROOM_METHOD.MESSAGE);
  });
});

describe("inbound message delivery + dedupe", () => {
  it("delivers an inbound room/message once", () => {
    const { manager, messages } = makeManager("bob");
    manager.joinRoom("r1", "host", "Room");

    const envelope: RoomMessageEnvelope = {
      roomId: "r1",
      messageId: "m1",
      senderPeerId: "carol",
      senderAlias: "Carol",
      text: "hey",
    };
    manager.handleNotification("host", ROOM_METHOD.MESSAGE, envelope);
    manager.handleNotification("carol", ROOM_METHOD.MESSAGE, envelope);

    expect(messages).toHaveLength(1);
    expect(messages[0].groupId).toBe("room:r1");
    expect(messages[0].sender).toBe("Carol");
    expect(messages[0].channel).toBe("room");
  });

  it("ignores messages for rooms not joined", () => {
    const { manager, messages } = makeManager("bob");
    manager.handleNotification("carol", ROOM_METHOD.MESSAGE, {
      roomId: "unknown",
      messageId: "m1",
      senderPeerId: "carol",
      text: "hi",
    });
    expect(messages).toHaveLength(0);
  });
});

describe("host relay forwarding", () => {
  it("forwards a relayed inner notification to the target", () => {
    const { manager, transport } = makeManager("host", ["carol"]);
    const room = manager.createRoom("Room");
    transport.sent = [];

    const inner: A2AJsonRpcNotification = {
      jsonrpc: "2.0",
      method: ROOM_METHOD.MESSAGE,
      params: {
        roomId: room.roomId,
        messageId: "x",
        senderPeerId: "bob",
        text: "yo",
      },
    };
    manager.handleNotification("bob", ROOM_METHOD.RELAY, {
      roomId: room.roomId,
      targetPeerId: "carol",
      inner,
    });

    expect(transport.sent).toEqual([{ peerId: "carol", note: inner }]);
  });
});

describe("invite", () => {
  it("sends a room/invite to the target peer", () => {
    const { manager, transport } = makeManager("host");
    const room = manager.createRoom("Room");
    transport.sent = [];

    const ok = manager.invite(room.roomId, "dave");
    expect(ok).toBe(true);
    const invites = transport.byMethod(ROOM_METHOD.INVITE);
    expect(invites[0].peerId).toBe("dave");
    expect((invites[0].note.params as any).hostPeerId).toBe("host");
  });

  it("delivers inbound invites to the onInvite callback", () => {
    const received: any[] = [];
    const { manager } = makeManager("bob", [], {
      onInvite: (i) => received.push(i),
    });
    manager.handleNotification("host", ROOM_METHOD.INVITE, {
      roomId: "r1",
      roomName: "Room",
      hostPeerId: "host",
      fromPeerId: "host",
    });
    expect(received).toHaveLength(1);
    expect(received[0].roomId).toBe("r1");
  });
});

describe("leaveRoom", () => {
  it("host disband notifies all members and removes the room", () => {
    const removed: string[] = [];
    const transport = new FakeTransport("host", ["bob"]);
    const manager = new RoomManager({
      transport,
      getLocalMember: () => member("host", "agent"),
      onMessage: () => {},
      removeRoom: (id) => removed.push(id),
    });
    const room = manager.createRoom("Room");
    manager.handleNotification("bob", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("bob"),
    });
    transport.sent = [];

    manager.leaveRoom(room.roomId);

    const leaves = transport.byMethod(ROOM_METHOD.LEAVE);
    expect(leaves[0].peerId).toBe("bob");
    expect((leaves[0].note.params as any).disbanded).toBe(true);
    expect(manager.get(room.roomId)).toBeNull();
    expect(removed).toEqual([room.roomId]);
  });

  it("member leave notifies the host", () => {
    const { manager, transport } = makeManager("bob", ["host"]);
    manager.joinRoom("r1", "host", "Room");
    transport.sent = [];

    manager.leaveRoom("r1");

    const leaves = transport.byMethod(ROOM_METHOD.LEAVE);
    expect(leaves[0].peerId).toBe("host");
    expect((leaves[0].note.params as any).disbanded).toBeUndefined();
    expect(manager.get("r1")).toBeNull();
  });

  it("a member receiving a disband removes the room locally", () => {
    const { manager } = makeManager("bob");
    manager.joinRoom("r1", "host", "Room");
    manager.handleNotification("host", ROOM_METHOD.LEAVE, {
      roomId: "r1",
      peerId: "host",
      disbanded: true,
    });
    expect(manager.get("r1")).toBeNull();
  });
});

describe("loadRooms + signal", () => {
  it("loads persisted rooms and publishes to the signal", () => {
    const { manager } = makeManager("host");
    const room: RoomMeta = {
      roomId: "r1",
      name: "Room",
      hostPeerId: "host",
      members: [member("host", "agent")],
      createdAt: 1,
    };
    manager.loadRooms([room]);
    expect(manager.list()).toHaveLength(1);
    expect(manager.roomsSignal.get()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Shared A2UI surfaces (owner-authoritative)
// ---------------------------------------------------------------------------

function createSurfaceEnvelope(surfaceId: string): A2UIEnvelope {
  return {
    type: "createSurface",
    surfaceId,
    catalogId: A2UI_MINIMAL_CATALOG_ID,
    rootComponentId: "root",
    components: {
      root: { component: "Text", text: "shared" } as any,
    },
  };
}

function action(surfaceId: string, actionId = "increment"): A2UIAction {
  return {
    type: "a2ui-action",
    surfaceId,
    actionId,
    dataModel: { count: 1 },
  };
}

describe("broadcastA2UI (shared surface)", () => {
  it("broadcasts the envelope to all members and records local ownership", () => {
    const { manager, transport } = makeManager("host", ["bob", "carol"]);
    const room = manager.createRoom("Room");
    manager.handleNotification("bob", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("bob"),
    });
    manager.handleNotification("carol", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("carol"),
    });
    transport.sent = [];

    const envelope = createSurfaceEnvelope("surf-1");
    manager.broadcastA2UI(room.roomId, envelope);

    const sends = transport.byMethod(ROOM_METHOD.A2UI);
    expect(sends.map((s) => s.peerId).sort()).toEqual(["bob", "carol"]);
    const payload = sends[0].note.params as RoomA2UIEnvelope;
    expect(payload.ownerPeerId).toBe("host");
    expect(payload.senderPeerId).toBe("host");
    expect(payload.envelope).toEqual(envelope);

    expect(manager.getSurfaceOwner("surf-1")).toBe("host");
  });

  it("returns null and sends nothing for a room that is not joined", () => {
    const { manager, transport } = makeManager("host");
    const id = manager.broadcastA2UI("unknown", createSurfaceEnvelope("s"));
    expect(id).toBeNull();
    expect(transport.sent).toHaveLength(0);
  });
});

describe("inbound A2UI surface (member)", () => {
  it("renders the surface once, records the owner, and dedupes echoes", () => {
    const { manager, messages } = makeManager("bob");
    manager.joinRoom("r1", "host", "Room");

    const envelope = createSurfaceEnvelope("surf-1");
    const payload: RoomA2UIEnvelope = {
      roomId: "r1",
      broadcastId: "b1",
      ownerPeerId: "host",
      senderPeerId: "host",
      envelope,
    };
    // Same broadcast arriving via mesh and host relay must deliver once.
    manager.handleNotification("host", ROOM_METHOD.A2UI, payload);
    manager.handleNotification("carol", ROOM_METHOD.A2UI, payload);

    expect(messages).toHaveLength(1);
    const inbound = messages[0] as InboundMessage;
    expect(inbound.groupId).toBe("room:r1");
    expect(inbound.channel).toBe("room");
    expect(inbound.a2uiEnvelopes).toEqual([envelope]);
    expect(manager.getSurfaceOwner("surf-1")).toBe("host");
  });

  it("ignores surfaces for rooms not joined", () => {
    const { manager, messages } = makeManager("bob");
    manager.handleNotification("host", ROOM_METHOD.A2UI, {
      roomId: "nope",
      broadcastId: "b1",
      ownerPeerId: "host",
      senderPeerId: "host",
      envelope: createSurfaceEnvelope("s"),
    });
    expect(messages).toHaveLength(0);
  });
});

describe("broadcastA2UIAction (shared surface)", () => {
  it("broadcasts the action to members with the recorded surface owner", () => {
    const { manager, transport } = makeManager("bob", ["host", "carol"]);
    manager.joinRoom("r1", "host", "Room");
    manager.handleNotification("host", ROOM_METHOD.ROSTER, {
      roomId: "r1",
      name: "Room",
      hostPeerId: "host",
      members: [member("host", "agent"), member("bob"), member("carol")],
    });
    // Learn that "host" owns the surface.
    manager.handleNotification("host", ROOM_METHOD.A2UI, {
      roomId: "r1",
      broadcastId: "b1",
      ownerPeerId: "host",
      senderPeerId: "host",
      envelope: createSurfaceEnvelope("surf-1"),
    });
    transport.sent = [];

    manager.broadcastA2UIAction("r1", action("surf-1"));

    const sends = transport.byMethod(ROOM_METHOD.A2UI_ACTION);
    expect(sends.map((s) => s.peerId).sort()).toEqual(["carol", "host"]);
    const payload = sends[0].note.params as RoomA2UIActionEnvelope;
    expect(payload.ownerPeerId).toBe("host");
    expect(payload.senderPeerId).toBe("bob");
    expect(payload.action.actionId).toBe("increment");
  });
});

describe("inbound A2UI action (owner-authoritative)", () => {
  it("the surface owner processes the action via an [A2UI ACTION] trigger", () => {
    // host owns surf-1 (it broadcast the surface).
    const { manager, messages } = makeManager("host", ["bob"]);
    const room = manager.createRoom("Room");
    manager.handleNotification("bob", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("bob"),
    });
    manager.broadcastA2UI(room.roomId, createSurfaceEnvelope("surf-1"));

    const payload: RoomA2UIActionEnvelope = {
      roomId: room.roomId,
      broadcastId: "act-1",
      ownerPeerId: "host",
      senderPeerId: "bob",
      senderAlias: "Bob",
      action: action("surf-1"),
    };
    manager.handleNotification("bob", ROOM_METHOD.A2UI_ACTION, payload);

    expect(messages).toHaveLength(1);
    const inbound = messages[0] as InboundMessage;
    expect(inbound.content.startsWith("[A2UI ACTION]")).toBe(true);
    expect(inbound.content).toContain("Bob");
    expect(inbound.a2uiAction).toEqual(payload.action);
  });

  it("non-owners ignore the action (no local agent trigger)", () => {
    // bob is a member; carol owns the surface. bob must NOT process the action.
    const { manager, messages } = makeManager("bob");
    manager.joinRoom("r1", "host", "Room");
    manager.handleNotification("carol", ROOM_METHOD.A2UI, {
      roomId: "r1",
      broadcastId: "b1",
      ownerPeerId: "carol",
      senderPeerId: "carol",
      envelope: createSurfaceEnvelope("surf-1"),
    });
    const surfaceMessages = messages.length; // the surface render delivery

    manager.handleNotification("carol", ROOM_METHOD.A2UI_ACTION, {
      roomId: "r1",
      broadcastId: "act-1",
      ownerPeerId: "carol",
      senderPeerId: "dave",
      action: action("surf-1"),
    });

    // No additional [A2UI ACTION] trigger message was delivered.
    expect(messages).toHaveLength(surfaceMessages);
  });

  it("does not let an inbound broadcast hijack a locally owned surface", () => {
    // host owns surf-1; a malicious peer claims ownership and fires an action.
    const { manager, messages } = makeManager("host", ["mallory"]);
    const room = manager.createRoom("Room");
    manager.handleNotification("mallory", ROOM_METHOD.JOIN, {
      roomId: room.roomId,
      member: member("mallory"),
    });
    manager.broadcastA2UI(room.roomId, createSurfaceEnvelope("surf-1"));
    const before = messages.length;

    // An inbound surface broadcast must not override our local ownership.
    manager.handleNotification("mallory", ROOM_METHOD.A2UI, {
      roomId: room.roomId,
      broadcastId: "b2",
      ownerPeerId: "mallory",
      senderPeerId: "mallory",
      envelope: createSurfaceEnvelope("surf-1"),
    });
    expect(manager.getSurfaceOwner("surf-1")).toBe("host");

    // Because we still own it, an action targeting surf-1 IS processed by us.
    manager.handleNotification("mallory", ROOM_METHOD.A2UI_ACTION, {
      roomId: room.roomId,
      broadcastId: "act-1",
      ownerPeerId: "mallory",
      senderPeerId: "mallory",
      action: action("surf-1"),
    });

    const triggers = messages
      .slice(before)
      .filter((m) => m.content.startsWith("[A2UI ACTION]"));
    expect(triggers).toHaveLength(1);
  });
});
