import { post } from "../../post.js";
import { ROOM_PREFIX, roomIdFromGroupId } from "../../../db/rooms.js";

export function executeLeaveRoom(
  input: Record<string, any>,
  groupId: string,
): string {
  const roomId =
    String(input.room_id || "").trim() ||
    (groupId.startsWith(ROOM_PREFIX) ? roomIdFromGroupId(groupId) : "");

  if (!roomId) {
    return "Error: no room_id provided and the current conversation is not a room.";
  }

  post({
    payload: { action: "leave", roomId },
    type: "room-action",
  });

  return `Leaving room ${roomId}.`;
}
