/**
 * @typedef {import("../../src/db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { CONFIG_KEYS } from "../config.mjs";
import { getConfig } from "../db/getConfig.mjs";

/**
 * @param {any} handle
 *
 * @returns {boolean}
 */
function isDirectoryHandle(handle) {
  if (!handle || typeof handle !== "object") {
    return false;
  }

  const ctor = globalThis.FileSystemDirectoryHandle;
  if (typeof ctor !== "undefined" && handle instanceof ctor) {
    return true;
  }

  return (
    typeof handle.getDirectoryHandle === "function" &&
    typeof handle.getFileHandle === "function" &&
    typeof handle.requestPermission === "function"
  );
}

/**
 * Request storage handle permission if needed.
 *
 * @param {ShadowClawDatabase} db
 *
 * @returns {Promise<boolean>}
 */
export async function requestStorageAccess(db) {
  const handle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
  if (isDirectoryHandle(handle)) {
    const status = await /** @type {any} */ (handle).requestPermission({
      mode: "readwrite",
    });

    return status === "granted";
  }

  return true; // No handle means OPFS, which always has "access"
}
