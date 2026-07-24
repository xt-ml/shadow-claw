import {
  getRoomMetadata,
  ROOM_PREFIX,
  roomIdFromGroupId,
} from "../../../db/rooms.js";
import { ShadowClawDatabase } from "../../../db/types.js";

export async function executeListRoomMembers(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const roomId =
    String(input.room_id || "").trim() ||
    (groupId.startsWith(ROOM_PREFIX) ? roomIdFromGroupId(groupId) : "");

  if (!roomId) {
    return "Error: no room_id provided and the current conversation is not a room.";
  }

  const rooms = await getRoomMetadata(db);
  const room = rooms.find((r) => r.roomId === roomId);

  if (!room) {
    return `Error: room ${roomId} was not found.`;
  }

  if (!room.members.length) {
    return `Room "${room.name}" (${roomId}) has no members yet.`;
  }

  const lines = room.members.map((m) => {
    const label =
      m.kind === "agent"
        ? `agent${m.agentName ? ` (@${m.agentName})` : ""}`
        : "human";
    const host = m.peerId === room.hostPeerId ? " [host]" : "";

    return `- ${m.alias || m.peerId} — ${label}${host} (peer: ${m.peerId})`;
  });

  return `Room "${room.name}" (${roomId}) members:\n${lines.join("\n")}`;
}
