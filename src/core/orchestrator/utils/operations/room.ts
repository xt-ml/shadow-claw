import type { RoomInvitePayload } from "../../../../subsystems/channels/peer-protocol.js";
import type { RoomManager } from "../../../../subsystems/channels/room-manager.js";
import type { RoomMeta } from "../../../../subsystems/channels/types.js";
import type { EventBus } from "../EventBus.js";

interface RoomOpsState {
  events: EventBus;
  roomManager: RoomManager;
}

/** Create a new room hosted by the local peer. */
export function createRoom(state: RoomOpsState, name: string): RoomMeta {
  const room = state.roomManager.createRoom(name);
  state.events.emit("rooms-changed", state.roomManager.list());

  return room;
}

/** Invite a (trusted) peer into an existing room. */
export function inviteToRoom(
  state: RoomOpsState,
  roomId: string,
  peerId: string,
): boolean {
  return state.roomManager.invite(roomId, peerId);
}

/** Join a room advertised by a host (e.g. via a shared link/QR). */
export function joinRoomViaLink(
  state: RoomOpsState,
  roomId: string,
  hostPeerId: string,
  name: string,
): RoomMeta {
  const room = state.roomManager.joinRoom(roomId, hostPeerId, name);
  state.events.emit("rooms-changed", state.roomManager.list());

  return room;
}

/** Leave (member) or disband (host) a room. */
export function leaveRoom(state: RoomOpsState, roomId: string): void {
  state.roomManager.leaveRoom(roomId);
  state.events.emit("rooms-changed", state.roomManager.list());
}

/** List all joined rooms. */
export function listRooms(state: RoomOpsState): RoomMeta[] {
  return state.roomManager.list();
}

/** Handle an incoming room invite from a peer. */
export function handleRoomInvite(
  state: Pick<RoomOpsState, "events">,
  invite: RoomInvitePayload,
): void {
  state.events.emit("room-invite", invite);
}
