import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { post } = await import("../../utils/post.js");
const { executeCreateRoom } = await import("./create-room.js");

describe("executeCreateRoom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if name is missing or empty", () => {
    expect(executeCreateRoom({})).toBe("Error: a room name is required.");
    expect(executeCreateRoom({ name: "   " })).toBe(
      "Error: a room name is required.",
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("posts room-action with create action and name", () => {
    const result = executeCreateRoom({ name: "My Room" });

    expect(post).toHaveBeenCalledWith({
      type: "room-action",
      payload: { action: "create", name: "My Room" },
    });

    expect(result).toBe(
      'Creating room "My Room". You will be the host; once it is ready you can invite peers with invite_to_room.',
    );
  });
});
