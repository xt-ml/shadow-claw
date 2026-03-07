/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Read a file from a group's workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} filePath
 *
 * @returns {Promise<string>}
 */
export async function readGroupFile(db, groupId, filePath) {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();

  return file.text();
}
