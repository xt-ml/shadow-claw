/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Read a file from a group's workspace.
 *
 * Supports two storage backends:
 * - True OPFS: uses createSyncAccessHandle() for guaranteed fresh reads
 * - File System Access API (showDirectoryPicker): uses getFile() with
 *   freshly-resolved handles so Chrome re-stats the underlying filesystem
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

  // Re-acquire file handle and file object to force filesystem re-stat
  const fileHandle = await dir.getFileHandle(filename);

  // Try OPFS-only createSyncAccessHandle for guaranteed fresh read
  try {
    // @ts-ignore — createSyncAccessHandle is only on OPFS handles in Workers
    const syncHandle = await fileHandle.createSyncAccessHandle();
    const size = syncHandle.getSize();
    const buf = new Uint8Array(size);

    syncHandle.read(buf, { at: 0 });
    syncHandle.close();

    return new TextDecoder("utf-8").decode(buf);
  } catch {
    // Not OPFS or not in a Worker — use File System Access API path
    const file = await fileHandle.getFile();
    return file.text();
  }
}
