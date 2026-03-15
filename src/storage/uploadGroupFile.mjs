/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { OPFS_ROOT } from "../config.mjs";
import { getGroupDir } from "./getGroupDir.mjs";
import { parsePath } from "./parsePath.mjs";
import { getStorageStatus } from "./storage.mjs";
import { writeFileHandle, writeOpfsPathViaWorker } from "./writeFileHandle.mjs";

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
  const { dirs, filename } = parsePath(filePath);

  const groupDir = await getGroupDir(db, groupId);
  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }
  const fileHandle = await dir.getFileHandle(filename, { create: true });

  try {
    await writeFileHandle(fileHandle, blob);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsOpfsWorkerFallback =
      message.includes("Writable file streams are not supported") &&
      (await getStorageStatus(db)).type === "opfs";

    if (!needsOpfsWorkerFallback) {
      throw err;
    }
  }

  const safeId = groupId.replace(/:/g, "-");
  await writeOpfsPathViaWorker(
    [OPFS_ROOT, "groups", safeId, ...dirs, filename],
    blob,
  );
}
