/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Delete a directory recursively from a group's workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} dirPath
 *
 * @returns {Promise<void>}
 */
export async function deleteGroupDirectory(db, groupId, dirPath) {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename: dirName } = parsePath(dirPath.replace(/\/$/, ""));

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  // recursive: true makes it delete non-empty directories
  await dir.removeEntry(dirName, { recursive: true });
}
