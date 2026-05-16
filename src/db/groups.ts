/**
 * ShadowClaw — Group (conversation) metadata management
 * Stores group metadata in the config store as JSON.
 */

import { DEFAULT_GROUP_ID } from "../config.js";
import { getConfig } from "./getConfig.js";
import { setConfig } from "./setConfig.js";
import { ulid } from "../ulid.js";
import type { ShadowClawDatabase, GroupMeta } from "../types.js";

const CONFIG_KEY = "group_metadata";

/**
 * Get all group metadata from config.
 */
export async function getGroupMetadata(
  db: ShadowClawDatabase,
): Promise<GroupMeta[]> {
  const raw = await getConfig(db, CONFIG_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save group metadata to config.
 */
export async function saveGroupMetadata(
  db: ShadowClawDatabase,
  metadata: GroupMeta[],
): Promise<void> {
  await setConfig(db, CONFIG_KEY, JSON.stringify(metadata));
}

/**
 * Create a new group and persist it.
 */
export async function createGroup(
  db: ShadowClawDatabase,
  name: string,
  prefix: string = "br:",
): Promise<GroupMeta> {
  const groups = await getGroupMetadata(db);
  const group: GroupMeta = {
    groupId: `${prefix}${ulid()}`,
    name,
    createdAt: Date.now(),
  };
  groups.push(group);
  await saveGroupMetadata(db, groups);

  return group;
}

/**
 * Rename an existing group.
 */
export async function renameGroup(
  db: ShadowClawDatabase,
  groupId: string,
  newName: string,
): Promise<void> {
  const groups = await getGroupMetadata(db);
  const group = groups.find((g) => g.groupId === groupId);
  if (group) {
    group.name = newName;
  }

  await saveGroupMetadata(db, groups);
}

/**
 * Update the tool tags pinned to an existing group.
 */
export async function updateGroupToolTags(
  db: ShadowClawDatabase,
  groupId: string,
  tags: string[],
): Promise<void> {
  const groups = await getGroupMetadata(db);
  const group = groups.find((g) => g.groupId === groupId);
  if (group) {
    group.toolTags = tags;
  }

  await saveGroupMetadata(db, groups);
}

/**
 * Delete a group from metadata.
 */
export async function deleteGroupMetadata(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<void> {
  const groups = await getGroupMetadata(db);
  const filtered = groups.filter((g) => g.groupId !== groupId);
  await saveGroupMetadata(db, filtered);
}

/**
 * List all groups in their persisted order.
 * If no groups exist, returns a default "Main" group.
 */
export async function listGroups(db: ShadowClawDatabase): Promise<GroupMeta[]> {
  const groups = await getGroupMetadata(db);
  if (groups.length === 0) {
    const defaultGroup: GroupMeta = {
      groupId: DEFAULT_GROUP_ID,
      name: "Main",
      createdAt: 0,
    };
    await saveGroupMetadata(db, [defaultGroup]);

    return [defaultGroup];
  }

  return groups;
}

/**
 * Reorder groups according to a provided list of groupIds.
 * Groups not in the list are appended at the end in their original order.
 */
export async function reorderGroups(
  db: ShadowClawDatabase,
  orderedIds: string[],
): Promise<void> {
  const groups = await getGroupMetadata(db);
  const byId = new Map(groups.map((g) => [g.groupId, g]));

  const reordered: GroupMeta[] = [];
  for (const id of orderedIds) {
    const g = byId.get(id);
    if (g) {
      reordered.push(g);
      byId.delete(id);
    }
  }

  // Append any groups not mentioned in orderedIds
  for (const g of groups) {
    if (byId.has(g.groupId)) {
      reordered.push(g);
    }
  }

  await saveGroupMetadata(db, reordered);
}

/**
 * Clone a group (metadata only). Messages must be cloned separately.
 * Returns null if the source group is not found.
 */
export async function cloneGroup(
  db: ShadowClawDatabase,
  sourceGroupId: string,
): Promise<GroupMeta | null> {
  const groups = await getGroupMetadata(db);
  const source = groups.find((g) => g.groupId === sourceGroupId);
  if (!source) {
    return null;
  }

  // Extract prefix from the source groupId (e.g. "br:" from "br:abc123")
  const colonIdx = sourceGroupId.indexOf(":");
  const prefix = colonIdx >= 0 ? sourceGroupId.slice(0, colonIdx + 1) : "br:";

  const clone: GroupMeta = {
    groupId: `${prefix}${ulid()}`,
    name: `${source.name} (copy)`,
    createdAt: Date.now(),
    toolTags: source.toolTags ? [...source.toolTags] : undefined,
  };
  groups.push(clone);
  await saveGroupMetadata(db, groups);

  return clone;
}
