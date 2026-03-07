/**
 * @typedef {import("../../src/db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { CONFIG_KEYS } from "../config.mjs";
import { getConfig } from "../db/getConfig.mjs";

/**
 * Request storage handle permission if needed.
 *
 * @param {ShadowClawDatabase} db
 *
 * @returns {Promise<boolean>}
 */
export async function requestStorageAccess(db) {
  const handle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
  if (
    handle &&
    /** @type {any} */ (handle) instanceof FileSystemDirectoryHandle
  ) {
    const status = await /** @type {any} */ (handle).requestPermission({
      mode: "readwrite",
    });

    return status === "granted";
  }

  return true; // No handle means OPFS, which always has "access"
}
