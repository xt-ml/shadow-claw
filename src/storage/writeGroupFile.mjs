/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Write content to a file in a group's workspace.
 * Creates intermediate directories as needed.
 *
 * @param {ShadowClawDatabase} db
 *
 * @param {string} groupId
 * @param {string} filePath
 * @param {string} content
 *
 * @returns {Promise<void>}
 */
export async function writeGroupFile(db, groupId, filePath, content) {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }

  const fileHandle = await dir.getFileHandle(filename, { create: true });
  // @ts-ignore - createWritable is a newer File System Access API method
  const writable = await fileHandle.createWritable();

  await writable.write(content);
  await writable.close();
}
