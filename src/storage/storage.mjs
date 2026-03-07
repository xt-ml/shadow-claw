import { CONFIG_KEYS, OPFS_ROOT } from "../config.mjs";
import { deleteConfig } from "../db/deleteConfig.mjs";
import { getConfig } from "../db/getConfig.mjs";

/**
 * ShadowClaw — OPFS (Origin Private File System) helpers
 */

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * @typedef {Object} StorageStatus
 *
 * @property {'opfs' | 'local'} type
 * @property {'granted' | 'denied' | 'prompt'} permission
 * @property {string | null} name
 */

/** @type {FileSystemDirectoryHandle | null} */
let explicitRoot = null;

/**
 * Get the current storage root handle.
 *
 * @param {ShadowClawDatabase} db
 *
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function getStorageRoot(db) {
  if (explicitRoot) {
    return explicitRoot;
  }

  try {
    const handle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
    if (
      handle &&
      /** @type {any} */ (handle) instanceof FileSystemDirectoryHandle
    ) {
      // Check if we still have permission
      const status = await /** @type {any} */ (handle).queryPermission({
        mode: "readwrite",
      });
      if (status === "granted") return handle;
      // Note: We don't fall back to OPFS here if a handle EXISTS but needs permission,
      // because that would lead to "split brain" where the user thinks they are in
      // their shared folder but are actually in OPFS.
      // However, for API calls, we might need a handle.
      // Tools will fail if they try to use it and it's not granted.
      return handle;
    }
  } catch (err) {
    console.warn("Failed to retrieve local storage handle:", err);
  }

  // Fallback to OPFS root
  const opfsRoot = await navigator.storage.getDirectory();
  return opfsRoot.getDirectoryHandle(OPFS_ROOT, { create: true });
}

/**
 * Set an explicit storage root handle (used to sync handle to workers).
 * @param {FileSystemDirectoryHandle} handle
 */
export function setStorageRoot(handle) {
  explicitRoot = handle;
}

/**
 * Reset storage to use browser-internal OPFS.
 *
 * @param {ShadowClawDatabase} db
 *
 * @returns {Promise<void>}
 */
export async function resetStorageDirectory(db) {
  await deleteConfig(db, CONFIG_KEYS.STORAGE_HANDLE);

  explicitRoot = null;
}

/**
 * Get the current storage status.
 *
 * @param {ShadowClawDatabase} db
 *
 * @returns {Promise<StorageStatus>}
 */
export async function getStorageStatus(db) {
  if (explicitRoot) {
    return { type: "local", permission: "granted", name: explicitRoot.name };
  }

  try {
    const handle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);

    if (
      handle &&
      /** @type {any} */ (handle) instanceof FileSystemDirectoryHandle
    ) {
      const permission = await /** @type {any} */ (handle).queryPermission({
        mode: "readwrite",
      });

      return { type: "local", permission, name: handle.name };
    }
  } catch (err) {
    console.warn("Failed to check storage status:", err);
  }

  return { type: "opfs", permission: "granted", name: "OPFS" };
}
