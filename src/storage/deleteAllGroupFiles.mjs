import { getGroupDir } from "./getGroupDir.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Recursively delete all files and directories in a group's workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 *
 * @returns {Promise<void>}
 */
export async function deleteAllGroupFiles(db, groupId) {
  const groupDir = await getGroupDir(db, groupId);

  // Delete everything in the group directory
  // @ts-ignore - entries() is a newer File System Access API iterator method
  for await (const [name] of groupDir.entries()) {
    await groupDir.removeEntry(name, { recursive: true });
  }
}
