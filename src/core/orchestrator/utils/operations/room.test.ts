import { jest } from "@jest/globals";

import { createRoom, inviteToRoom, leaveRoom } from "./room.js";

function makeState() {
  return {
    events: { emit: jest.fn() } as any,
    roomManager: {
      createRoom: jest.fn().mockReturnValue({ roomId: "room1" }),
      invite: jest.fn().mockReturnValue(true),
      leaveRoom: jest.fn(),
      list: jest.fn().mockReturnValue([]),
    } as any,
  };
}

describe("room operations", () => {
  it("createRoom delegates and emits", () => {
    const state = makeState();
    const room = createRoom(state, "test-room");
    expect(room.roomId).toBe("room1");
    expect(state.events.emit).toHaveBeenCalledWith("rooms-changed", []);
  });

  it("inviteToRoom delegates", () => {
    const state = makeState();
    expect(inviteToRoom(state, "room1", "peer1")).toBe(true);
    expect(state.roomManager.invite).toHaveBeenCalledWith("room1", "peer1");
  });

  it("leaveRoom delegates and emits", () => {
    const state = makeState();
    leaveRoom(state, "room1");
    expect(state.roomManager.leaveRoom).toHaveBeenCalledWith("room1");
    expect(state.events.emit).toHaveBeenCalledWith("rooms-changed", []);
  });
});
