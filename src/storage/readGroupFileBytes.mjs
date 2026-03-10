/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Read raw bytes from a file in a group's workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} filePath
 *
 * @returns {Promise<Uint8Array>}
 */
export async function readGroupFileBytes(db, groupId, filePath) {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  const fileHandle = await dir.getFileHandle(filename);

  try {
    // @ts-ignore - createSyncAccessHandle only exists for OPFS handles.
    const syncHandle = await fileHandle.createSyncAccessHandle();
    const size = syncHandle.getSize();
    const buf = new Uint8Array(size);

    syncHandle.read(buf, { at: 0 });
    syncHandle.close();

    return buf;
  } catch {
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();

    return new Uint8Array(arrayBuffer);
  }
}
