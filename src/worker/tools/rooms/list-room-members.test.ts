import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../db/rooms.js", () => ({
  ROOM_PREFIX: "room:",
  roomIdFromGroupId: (g: string) => g.replace(/^room:/, ""),
  getRoomMetadata: jest.fn(),
}));

const { executeListRoomMembers } = await import("./list-room-members.js");
const { getRoomMetadata } = await import("../../../db/rooms.js");

describe("executeListRoomMembers", () => {
  const mockDb: any = {};

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
    (getRoomMetadata as jest.Mock<any>).mockResolvedValue([]);

    const result = await executeListRoomMembers(
      mockDb,
      { room_id: "missing-room" },
      "default",
    );
    expect(result).toBe("Error: room missing-room was not found.");
  });

  it("handles room with no members", async () => {
    (getRoomMetadata as jest.Mock<any>).mockResolvedValue([
      { roomId: "room-1", name: "Empty Room", members: [] },
    ]);

    const result = await executeListRoomMembers(
      mockDb,
      { room_id: "room-1" },
      "default",
    );
    expect(result).toBe('Room "Empty Room" (room-1) has no members yet.');
  });

  it("formats members list including agents and hosts", async () => {
    (getRoomMetadata as jest.Mock<any>).mockResolvedValue([
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
        ],
      },
    ]);

    const result = await executeListRoomMembers(mockDb, {}, "room:room-1");
    expect(result).toContain('Room "Dev Team" (room-1) members:');
    expect(result).toContain("- Host Alice — human [host] (peer: peer-host)");
    expect(result).toContain(
      "- Assistant Bot — agent (@coder) (peer: peer-bot)",
    );
  });
});
