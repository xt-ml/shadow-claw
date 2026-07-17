import { post } from "../../post.js";
import { ROOM_PREFIX, roomIdFromGroupId } from "../../../db/rooms.js";

export function executeInviteToRoom(
  input: Record<string, any>,
  groupId: string,
): string {
  const peerId = String(input.peer_id || "").trim();
  const roomId =
    String(input.room_id || "").trim() ||
    (groupId.startsWith(ROOM_PREFIX) ? roomIdFromGroupId(groupId) : "");

  if (!peerId) {
    return "Error: peer_id is required to invite a participant.";
  }

  if (!roomId) {
    return "Error: no room_id provided and the current conversation is not a room.";
  }

  post({
    payload: { action: "invite", roomId, peerId },
    type: "room-action",
  });

  return `Invited peer ${peerId} to room ${roomId}.`;
}
