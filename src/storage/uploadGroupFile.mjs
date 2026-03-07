/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Upload a file to a group's workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} filePath
 * @param {Blob} blob
 *
 * @returns {Promise<void>}
 */
export async function uploadGroupFile(db, groupId, filePath, blob) {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }

  const fileHandle = await dir.getFileHandle(filename, { create: true });
  // @ts-ignore - createWritable is a newer File System Access API method
  const writable = await fileHandle.createWritable();

  await writable.write(blob);
  await writable.close();
}
