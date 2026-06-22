import { jest } from "@jest/globals";

jest.unstable_mockModule("./getConfig.js", () => ({
  getConfig: jest.fn(),
}));
jest.unstable_mockModule("./setConfig.js", () => ({
  setConfig: jest.fn(),
}));
jest.unstable_mockModule("./groups.js", () => ({
  createGroup: jest.fn(),
  getGroupMetadata: jest.fn(),
}));
jest.unstable_mockModule("../utils/ulid.js", () => ({
  ulid: jest.fn(() => "ROOMID01"),
}));

const { getConfig } = await import("./getConfig.js");
const { setConfig } = await import("./setConfig.js");
const { createGroup, getGroupMetadata } = await import("./groups.js");
const {
  ROOM_PREFIX,
  roomGroupId,
  roomIdFromGroupId,
  getRoomMetadata,
  getRoom,
  createRoom,
  upsertRoom,
  addRoomMember,
  removeRoomMember,
  deleteRoom,
} = await import("./rooms.js");

import type { RoomMeta, RoomMember } from "../types.js";

const host: RoomMember = {
  peerId: "host-peer",
  alias: "Host",
  kind: "agent",
  agentName: "k9",
};

function makeRoom(overrides: Partial<RoomMeta> = {}): RoomMeta {
  return {
    roomId: "r1",
    name: "Test Room",
    hostPeerId: "host-peer",
    members: [host],
    createdAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getGroupMetadata as any).mockResolvedValue([]);
  (createGroup as any).mockResolvedValue({});
});

describe("room id helpers", () => {
  it("builds and parses room groupIds", () => {
    expect(roomGroupId("abc")).toBe("room:abc");
    expect(roomIdFromGroupId("room:abc")).toBe("abc");
    expect(roomIdFromGroupId("abc")).toBe("abc");
    expect(ROOM_PREFIX).toBe("room:");
  });
});

describe("getRoomMetadata", () => {
  it("returns [] when no config", async () => {
    (getConfig as any).mockResolvedValue(undefined);
    await expect(getRoomMetadata(null)).resolves.toEqual([]);
  });

  it("returns [] on malformed JSON", async () => {
    (getConfig as any).mockResolvedValue("not json");
    await expect(getRoomMetadata(null)).resolves.toEqual([]);
  });

  it("parses stored rooms", async () => {
    (getConfig as any).mockResolvedValue(JSON.stringify([makeRoom()]));
    const rooms = await getRoomMetadata(null);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomId).toBe("r1");
  });
});

describe("getRoom", () => {
  it("finds a room by id", async () => {
    (getConfig as any).mockResolvedValue(JSON.stringify([makeRoom()]));
    expect((await getRoom(null, "r1"))?.name).toBe("Test Room");
    expect(await getRoom(null, "missing")).toBeNull();
  });
});

describe("createRoom", () => {
  it("creates a room with the host as the first member and a matching group", async () => {
    (getConfig as any).mockResolvedValue(undefined);
    const room = await createRoom(null, "My Room", "host-peer", host);

    expect(room.roomId).toBe("ROOMID01");
    expect(room.members).toEqual([host]);
    expect(room.hostPeerId).toBe("host-peer");
    expect(setConfig).toHaveBeenCalledWith(
      null,
      "room_metadata",
      expect.stringContaining("ROOMID01"),
    );
    // Group is created with the room prefix and explicit id.
    expect(createGroup).toHaveBeenCalledWith(
      null,
      "My Room",
      "room:",
      "ROOMID01",
    );
  });

  it("does not recreate the group when one already exists", async () => {
    (getConfig as any).mockResolvedValue(undefined);
    (getGroupMetadata as any).mockResolvedValue([{ groupId: "room:ROOMID01" }]);
    await createRoom(null, "My Room", "host-peer", host);
    expect(createGroup).not.toHaveBeenCalled();
  });
});

describe("addRoomMember", () => {
  it("appends a new member", async () => {
    (getConfig as any).mockResolvedValue(JSON.stringify([makeRoom()]));
    const newMember: RoomMember = {
      peerId: "bob",
      alias: "Bob",
      kind: "human",
    };
    const room = await addRoomMember(null, "r1", newMember);
    expect(room?.members.map((m) => m.peerId)).toEqual(["host-peer", "bob"]);
    expect(setConfig).toHaveBeenCalled();
  });

  it("replaces an existing member with the same peerId", async () => {
    (getConfig as any).mockResolvedValue(JSON.stringify([makeRoom()]));
    const updated: RoomMember = {
      peerId: "host-peer",
      alias: "Renamed",
      kind: "agent",
    };
    const room = await addRoomMember(null, "r1", updated);
    expect(room?.members).toHaveLength(1);
    expect(room?.members[0].alias).toBe("Renamed");
  });

  it("returns null for an unknown room", async () => {
    (getConfig as any).mockResolvedValue(JSON.stringify([makeRoom()]));
    expect(
      await addRoomMember(null, "nope", {
        peerId: "x",
        alias: "x",
        kind: "human",
      }),
    ).toBeNull();
  });
});

describe("removeRoomMember", () => {
  it("removes a member by peerId", async () => {
    const room = makeRoom({
      members: [host, { peerId: "bob", alias: "Bob", kind: "human" }],
    });
    (getConfig as any).mockResolvedValue(JSON.stringify([room]));
    const updated = await removeRoomMember(null, "r1", "bob");
    expect(updated?.members.map((m) => m.peerId)).toEqual(["host-peer"]);
  });
});

describe("upsertRoom", () => {
  it("replaces an existing room in place", async () => {
    (getConfig as any).mockResolvedValue(JSON.stringify([makeRoom()]));
    (getGroupMetadata as any).mockResolvedValue([{ groupId: "room:r1" }]);
    await upsertRoom(null, makeRoom({ name: "Renamed" }));
    const saved = JSON.parse((setConfig as any).mock.calls[0][2]);
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Renamed");
  });
});

describe("deleteRoom", () => {
  it("removes a room record", async () => {
    (getConfig as any).mockResolvedValue(JSON.stringify([makeRoom()]));
    await deleteRoom(null, "r1");
    const saved = JSON.parse((setConfig as any).mock.calls[0][2]);
    expect(saved).toEqual([]);
  });
});
