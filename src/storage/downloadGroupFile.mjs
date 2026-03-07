/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";

/**
 * Download a single file
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} filePath
 *
 * @returns {Promise<void>}
 */
export async function downloadGroupFile(db, groupId, filePath) {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();

  // Create a download link and trigger download
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
