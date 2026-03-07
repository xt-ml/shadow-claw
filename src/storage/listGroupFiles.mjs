/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";

/**
 * List files and directories in a group's workspace directory.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} [dirPath='.']
 *
 * @returns {Promise<string[]>}
 */
export async function listGroupFiles(db, groupId, dirPath = ".") {
  const groupDir = await getGroupDir(db, groupId);

  let dir = groupDir;
  if (dirPath && dirPath !== ".") {
    const parts = dirPath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean);

    for (const seg of parts) {
      dir = await dir.getDirectoryHandle(seg);
    }
  }

  const entries = [];
  // @ts-ignore - entries() is a newer File System Access API iterator method
  for await (const [name, handle] of dir.entries()) {
    entries.push(handle.kind === "directory" ? `${name}/` : name);
  }

  return entries.sort();
}
