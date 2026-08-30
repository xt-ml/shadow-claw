import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { executeLeaveRoom } = await import("./leave-room.js");
const { post } = await import("../../utils/post.js");

describe("executeLeaveRoom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when room_id is missing and groupId is not a room", () => {
    const result = executeLeaveRoom({}, "main-group");
    expect(result).toBe(
      "Error: no room_id provided and the current conversation is not a room.",
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("leaves room with explicit room_id", () => {
    const result = executeLeaveRoom({ room_id: "room-abc" }, "main-group");
    expect(result).toBe("Leaving room room-abc.");
    expect(post).toHaveBeenCalledWith({
      payload: { action: "leave", roomId: "room-abc" },
      type: "room-action",
    });
  });

  it("leaves room inferring room from room groupId", () => {
    const result = executeLeaveRoom({}, "room:current-room");
    expect(result).toBe("Leaving room current-room.");
    expect(post).toHaveBeenCalledWith({
      payload: { action: "leave", roomId: "current-room" },
      type: "room-action",
    });
  });
});
