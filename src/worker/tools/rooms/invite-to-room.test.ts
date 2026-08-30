import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { executeInviteToRoom } = await import("./invite-to-room.js");
const { post } = await import("../../utils/post.js");

describe("executeInviteToRoom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when peer_id is missing", () => {
    const result = executeInviteToRoom({}, "br:room-123");
    expect(result).toBe("Error: peer_id is required to invite a participant.");
    expect(post).not.toHaveBeenCalled();
  });

  it("returns error when room_id is missing and groupId is not a room", () => {
    const result = executeInviteToRoom({ peer_id: "peer-abc" }, "default");
    expect(result).toBe(
      "Error: no room_id provided and the current conversation is not a room.",
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("invites peer using explicit room_id", () => {
    const result = executeInviteToRoom(
      { peer_id: "peer-abc", room_id: "custom-room" },
      "default",
    );

    expect(result).toBe("Invited peer peer-abc to room custom-room.");
    expect(post).toHaveBeenCalledWith({
      payload: { action: "invite", roomId: "custom-room", peerId: "peer-abc" },
      type: "room-action",
    });
  });

  it("invites peer inferring room from room groupId", () => {
    const result = executeInviteToRoom(
      { peer_id: "peer-xyz" },
      "room:active-room",
    );

    expect(result).toBe("Invited peer peer-xyz to room active-room.");
    expect(post).toHaveBeenCalledWith({
      payload: { action: "invite", roomId: "active-room", peerId: "peer-xyz" },
      type: "room-action",
    });
  });
});
