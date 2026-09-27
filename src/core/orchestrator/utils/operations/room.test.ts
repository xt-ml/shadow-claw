import { describe, expect, it, jest } from "@jest/globals";
import type { RoomInvitePayload } from "../../../../subsystems/channels/peer-protocol.js";
import type { RoomManager } from "../../../../subsystems/channels/room-manager.js";
import type { RoomMeta } from "../../../../subsystems/channels/types.js";
import type { EventBus } from "../EventBus.js";
import {
  createRoom,
  handleRoomInvite,
  inviteToRoom,
  joinRoomViaLink,
  leaveRoom,
  listRooms,
} from "./room.js";

function makeState() {
  const mockRoom: RoomMeta = {
    roomId: "room1",
    name: "test-room",
    hostPeerId: "peer-host",
    createdAt: Date.now(),
    members: [],
  };

  return {
    events: {
      emit: jest.fn<(...args: unknown[]) => unknown>(),
    } as unknown as EventBus,
    roomManager: {
      createRoom: jest.fn<() => RoomMeta>().mockReturnValue(mockRoom),
      invite: jest.fn<() => boolean>().mockReturnValue(true),
      joinRoom: jest.fn<() => RoomMeta>().mockReturnValue(mockRoom),
      leaveRoom: jest.fn<() => void>(),
      list: jest.fn<() => RoomMeta[]>().mockReturnValue([mockRoom]),
    } as unknown as RoomManager,
  };
}

describe("room operations", () => {
  it("createRoom delegates and emits", () => {
    const state = makeState();
    const room = createRoom(state, "test-room");
    expect(room.roomId).toBe("room1");
    expect(state.events.emit).toHaveBeenCalledWith("rooms-changed", [
      expect.objectContaining({ roomId: "room1" }),
    ]);
  });

  it("inviteToRoom delegates", () => {
    const state = makeState();
    expect(inviteToRoom(state, "room1", "peer1")).toBe(true);
    expect(state.roomManager.invite).toHaveBeenCalledWith("room1", "peer1");
  });

  it("joinRoomViaLink delegates and emits", () => {
    const state = makeState();
    const room = joinRoomViaLink(state, "room1", "peer-host", "test-room");
    expect(room.roomId).toBe("room1");
    expect(state.roomManager.joinRoom).toHaveBeenCalledWith(
      "room1",
      "peer-host",
      "test-room",
    );
    expect(state.events.emit).toHaveBeenCalledWith("rooms-changed", [
      expect.objectContaining({ roomId: "room1" }),
    ]);
  });

  it("leaveRoom delegates and emits", () => {
    const state = makeState();
    leaveRoom(state, "room1");
    expect(state.roomManager.leaveRoom).toHaveBeenCalledWith("room1");
    expect(state.events.emit).toHaveBeenCalledWith("rooms-changed", [
      expect.objectContaining({ roomId: "room1" }),
    ]);
  });

  it("listRooms returns rooms from roomManager", () => {
    const state = makeState();
    const rooms = listRooms(state);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomId).toBe("room1");
    expect(state.roomManager.list).toHaveBeenCalled();
  });

  it("handleRoomInvite emits room-invite event", () => {
    const state = {
      events: {
        emit: jest.fn<(...args: unknown[]) => unknown>(),
      } as unknown as EventBus,
    };
    const invite: RoomInvitePayload = {
      roomId: "room2",
      roomName: "invited-room",
      hostPeerId: "peer-host-2",
      fromPeerId: "peer-from-2",
    };
    handleRoomInvite(state, invite);
    expect(state.events.emit).toHaveBeenCalledWith("room-invite", invite);
  });
});
