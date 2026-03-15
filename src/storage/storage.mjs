import { CONFIG_KEYS, OPFS_ROOT } from "../config.mjs";
import { deleteConfig } from "../db/deleteConfig.mjs";
import { getConfig } from "../db/getConfig.mjs";

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
 * Determine whether a value behaves like a FileSystemDirectoryHandle.
 * In workers, `FileSystemDirectoryHandle` may be undefined, so rely on
 * capability checks as a fallback.
 *
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
    typeof handle.queryPermission === "function"
  );
}

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
    const storedHandle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
    if (isDirectoryHandle(storedHandle)) {
      const handle = /** @type {any} */ (storedHandle);
      // Check if we still have permission
      const status = await handle.queryPermission({
        mode: "readwrite",
      });

      // If we have a handle but no permission, we still return it so tools
      // fail with a clear "permission denied" error instead of silently
      // falling back to OPFS and causing "split brain".
      return handle;
    }
  } catch (err) {
    console.warn("Failed to retrieve local storage handle from DB:", err);
  }

  // Fallback to OPFS root only if NO local handle is configured
  const opfsRoot = await navigator.storage.getDirectory();
  return opfsRoot.getDirectoryHandle(OPFS_ROOT, { create: true });
}

/**
 * Set an explicit storage root handle (used to sync handle to workers).
 *
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
    try {
      const permission = await /** @type {any} */ (
        explicitRoot
      ).queryPermission({
        mode: "readwrite",
      });

      return { type: "local", permission, name: explicitRoot.name };
    } catch {
      // If queryPermission fails, explicitRoot might be stale
      console.warn("Getting storage status failed for explicit storage root.");
    }
  }

  try {
    const storedHandle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);

    if (isDirectoryHandle(storedHandle)) {
      const handle = /** @type {any} */ (storedHandle);
      const permission = await handle.queryPermission({
        mode: "readwrite",
      });

      return { type: "local", permission, name: handle.name };
    }
  } catch (err) {
    console.warn("Failed to check storage status:", err);
  }

  return { type: "opfs", permission: "granted", name: "OPFS" };
}
