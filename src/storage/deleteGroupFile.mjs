/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Delete a file from a group's workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} filePath
 *
 * @returns {Promise<void>}
 */
export async function deleteGroupFile(db, groupId, filePath) {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  await dir.removeEntry(filename);
}
