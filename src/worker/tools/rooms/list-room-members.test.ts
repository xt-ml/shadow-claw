import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { RoomMeta } from "../../../subsystems/channels/types.js";
import type { ShadowClawDatabase } from "../../../db/types.js";

const mockGetRoomMetadata = jest.fn<() => Promise<RoomMeta[]>>();

jest.unstable_mockModule("../../../db/rooms.js", () => ({
  ROOM_PREFIX: "room:",
  roomIdFromGroupId: (g: string) => g.replace(/^room:/, ""),
  getRoomMetadata: mockGetRoomMetadata,
}));

const { executeListRoomMembers } = await import("./list-room-members.js");

describe("executeListRoomMembers", () => {
  const mockDb = {} as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when room_id is missing and groupId is not a room", async () => {
    const result = await executeListRoomMembers(mockDb, {}, "not-a-room");
    expect(result).toBe(
      "Error: no room_id provided and the current conversation is not a room.",
    );
  });

  it("returns error when room is not found in database", async () => {
    mockGetRoomMetadata.mockResolvedValue([]);

    const result = await executeListRoomMembers(
      mockDb,
      { room_id: "missing-room" },
      "default",
    );
    expect(result).toBe("Error: room missing-room was not found.");
  });

  it("handles room with no members", async () => {
    mockGetRoomMetadata.mockResolvedValue([
      {
        roomId: "room-1",
        name: "Empty Room",
        members: [],
      } as unknown as RoomMeta,
    ]);

    const result = await executeListRoomMembers(
      mockDb,
      { room_id: "room-1" },
      "default",
    );
    expect(result).toBe('Room "Empty Room" (room-1) has no members yet.');
  });

  it("formats members list including agents, hosts, anonymous agents and missing aliases", async () => {
    mockGetRoomMetadata.mockResolvedValue([
      {
        roomId: "room-1",
        name: "Dev Team",
        hostPeerId: "peer-host",
        members: [
          { peerId: "peer-host", alias: "Host Alice", kind: "human" },
          {
            peerId: "peer-bot",
            alias: "Assistant Bot",
            kind: "agent",
            agentName: "coder",
          },
          {
            peerId: "peer-anon-agent",
            kind: "agent",
          },
        ],
      } as unknown as RoomMeta,
    ]);

    const result = await executeListRoomMembers(mockDb, {}, "room:room-1");
    expect(result).toContain('Room "Dev Team" (room-1) members:');
    expect(result).toContain("- Host Alice — human [host] (peer: peer-host)");
    expect(result).toContain(
      "- Assistant Bot — agent (@coder) (peer: peer-bot)",
    );
    expect(result).toContain(
      "- peer-anon-agent — agent (peer: peer-anon-agent)",
    );
  });
});
