/**
 * ShadowClaw — Room (multi-party conversation) metadata management
 *
 * A room is layered on top of a {@link GroupMeta} whose groupId is
 * `room:<roomId>` (so existing message storage, OPFS workspace, unread state,
 * and the conversation list work unchanged). This module persists the room
 * roster / host separately under a dedicated config key.
 */

import { getConfig } from "./getConfig.js";
import { setConfig } from "./setConfig.js";
import { createGroup } from "./groups.js";
import { ulid } from "../utils/ulid.js";
import type { ShadowClawDatabase } from "./types.js";
import type { RoomMember, RoomMeta } from "../subsystems/channels/types.js";

const CONFIG_KEY = "room_metadata";

/** The groupId prefix used for room conversations. */
export const ROOM_PREFIX = "room:";

/** Build the conversation groupId for a bare room id. */
export function roomGroupId(roomId: string): string {
  return `${ROOM_PREFIX}${roomId}`;
}

/** Extract the bare room id from a `room:<id>` groupId. */
export function roomIdFromGroupId(groupId: string): string {
  return groupId.startsWith(ROOM_PREFIX)
    ? groupId.slice(ROOM_PREFIX.length)
    : groupId;
}

/** Get all room metadata from config. */
export async function getRoomMetadata(
  db: ShadowClawDatabase,
): Promise<RoomMeta[]> {
  const raw = await getConfig(db, CONFIG_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save all room metadata to config. */
export async function saveRoomMetadata(
  db: ShadowClawDatabase,
  metadata: RoomMeta[],
): Promise<void> {
  await setConfig(db, CONFIG_KEY, JSON.stringify(metadata));
}

/** Get a single room by its bare room id. */
export async function getRoom(
  db: ShadowClawDatabase,
  roomId: string,
): Promise<RoomMeta | null> {
  const rooms = await getRoomMetadata(db);

  return rooms.find((r) => r.roomId === roomId) ?? null;
}

/**
 * Persist (insert or replace) a single room record and ensure a matching
 * conversation group exists.
 */
export async function upsertRoom(
  db: ShadowClawDatabase,
  room: RoomMeta,
): Promise<void> {
  const rooms = await getRoomMetadata(db);
  const index = rooms.findIndex((r) => r.roomId === room.roomId);
  if (index >= 0) {
    rooms[index] = room;
  } else {
    rooms.push(room);
  }

  await saveRoomMetadata(db, rooms);
  await ensureRoomGroup(db, room);
}

/**
 * Ensure a `room:<roomId>` GroupMeta exists for the given room so the
 * conversation, message history and workspace are available.
 */
async function ensureRoomGroup(
  db: ShadowClawDatabase,
  room: RoomMeta,
): Promise<void> {
  const { getGroupMetadata } = await import("./groups.js");
  const groups = await getGroupMetadata(db);
  const groupId = roomGroupId(room.roomId);
  if (groups.some((g) => g.groupId === groupId)) {
    return;
  }

  await createGroup(db, room.name, ROOM_PREFIX, room.roomId);
}

/**
 * Create a new room (as host) and persist it along with its conversation group.
 */
export async function createRoom(
  db: ShadowClawDatabase,
  name: string,
  hostPeerId: string,
  hostMember: RoomMember,
): Promise<RoomMeta> {
  const room: RoomMeta = {
    roomId: ulid(),
    name,
    hostPeerId,
    members: [hostMember],
    createdAt: Date.now(),
  };

  await upsertRoom(db, room);

  return room;
}

/** Add or update a member in a room's roster. Returns the updated room. */
export async function addRoomMember(
  db: ShadowClawDatabase,
  roomId: string,
  member: RoomMember,
): Promise<RoomMeta | null> {
  const rooms = await getRoomMetadata(db);
  const room = rooms.find((r) => r.roomId === roomId);
  if (!room) {
    return null;
  }

  const index = room.members.findIndex((m) => m.peerId === member.peerId);
  if (index >= 0) {
    room.members[index] = member;
  } else {
    room.members.push(member);
  }

  await saveRoomMetadata(db, rooms);

  return room;
}

/** Remove a member from a room's roster. Returns the updated room. */
export async function removeRoomMember(
  db: ShadowClawDatabase,
  roomId: string,
  peerId: string,
): Promise<RoomMeta | null> {
  const rooms = await getRoomMetadata(db);
  const room = rooms.find((r) => r.roomId === roomId);
  if (!room) {
    return null;
  }

  room.members = room.members.filter((m) => m.peerId !== peerId);
  await saveRoomMetadata(db, rooms);

  return room;
}

/** Delete a room record (does not delete its conversation group/messages). */
export async function deleteRoom(
  db: ShadowClawDatabase,
  roomId: string,
): Promise<void> {
  const rooms = await getRoomMetadata(db);
  await saveRoomMetadata(
    db,
    rooms.filter((r) => r.roomId !== roomId),
  );
}
