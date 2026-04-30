import { CONFIG_KEYS, OPFS_ROOT } from "../config.js";
import { deleteConfig } from "../db/deleteConfig.js";
import { getConfig } from "../db/getConfig.js";
import type { ShadowClawDatabase } from "../types.js";

export interface StorageStatus {
  type: "opfs" | "local";
  permission: "granted" | "denied" | "prompt";
  name: string | null;
}

let explicitRoot: FileSystemDirectoryHandle | null = null;

/**
 * Verify whether a directory handle is actually functional by attempting
 * to iterate its entries.
 */
async function probeHandleAccess(
  handle: FileSystemDirectoryHandle,
  reportedPermission: "granted" | "denied" | "prompt",
): Promise<"granted" | "denied" | "prompt"> {
  try {
    const iter = (handle as any).entries();
    await iter.next();

    // I/O succeeded — the handle is functional regardless of what
    // queryPermission reported.

    return "granted";
  } catch {
    return reportedPermission;
  }
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  const opfsRoot = await navigator.storage.getDirectory();

  return opfsRoot.getDirectoryHandle(OPFS_ROOT, { create: true });
}

/**
 * Determine whether a value behaves like a FileSystemDirectoryHandle.
 */
function isDirectoryHandle(handle: any): handle is FileSystemDirectoryHandle {
  if (!handle || typeof handle !== "object") {
    return false;
  }

  const ctor = globalThis.FileSystemDirectoryHandle;
  if (typeof ctor !== "undefined" && handle instanceof ctor) {
    return true;
  }

  return (
    typeof handle.getDirectoryHandle === "function" &&
    typeof handle.getFileHandle === "function"
  );
}

/**
 * Get the current storage root handle.
 */
export async function getStorageRoot(
  db: ShadowClawDatabase,
): Promise<FileSystemDirectoryHandle> {
  if (explicitRoot) {
    return explicitRoot;
  }

  try {
    const storedHandle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
    if (isDirectoryHandle(storedHandle)) {
      const handle = storedHandle as any;
      // Check if we still have permission (main thread only)
      if (typeof handle.queryPermission === "function") {
        const status = await handle.queryPermission({
          mode: "readwrite",
        });

        // Electron (and some other embedders) report "prompt" even when the
        // handle is functional. Try to silently re-activate the permission
        // so downstream code doesn't hit stale-handle errors.
        if (
          status !== "granted" &&
          typeof handle.requestPermission === "function"
        ) {
          try {
            await handle.requestPermission({ mode: "readwrite" });
          } catch {
            // requestPermission may throw in some contexts — that's OK
          }
        }
      }

      // If we have a handle but no permission, we still return it so tools
      // fail with a clear "permission denied" error instead of silently
      // falling back to OPFS and causing "split brain".

      return handle;
    }
  } catch (err) {
    console.warn("Failed to retrieve local storage handle from DB:", err);
  }

  // Fallback to OPFS root only if NO local handle is configured

  return getOpfsRoot();
}

/**
 * Set an explicit storage root handle (used to sync handle to workers).
 */
export function setStorageRoot(handle: FileSystemDirectoryHandle): void {
  explicitRoot = handle;
}

/**
 * Clear the cached storage root so the next call to getStorageRoot()
 * re-acquires a fresh handle.  Call this when an InvalidStateError
 * indicates the cached handle has gone stale.
 */
export function invalidateStorageRoot() {
  explicitRoot = null;
}

/**
 * Detect a stale-handle DOMException ("InvalidStateError") thrown by
 * the File System Access API when the underlying entry has changed
 * since the handle was obtained.
 */
export function isStaleHandleError(err: unknown): boolean {
  if (!(err instanceof DOMException)) {
    return false;
  }

  return err.name === "InvalidStateError";
}

/**
 * Reset storage to use browser-internal OPFS.
 */
export async function resetStorageDirectory(
  db: ShadowClawDatabase,
): Promise<void> {
  await deleteConfig(db, CONFIG_KEYS.STORAGE_HANDLE);

  explicitRoot = null;
}

/**
 * Get the current storage status.
 */
export async function getStorageStatus(
  db: ShadowClawDatabase,
): Promise<StorageStatus> {
  if (explicitRoot) {
    try {
      const permission = await (explicitRoot as any).queryPermission({
        mode: "readwrite",
      });

      // Electron may report "prompt" even when the handle works.
      // Test actual functionality before reporting the permission level.
      const effectivePermission =
        permission === "granted"
          ? "granted"
          : await probeHandleAccess(explicitRoot, permission);

      return {
        type: "local",
        permission: effectivePermission,
        name: explicitRoot.name,
      };
    } catch {
      // If queryPermission fails, explicitRoot might be stale
      console.warn("Getting storage status failed for explicit storage root.");
    }
  }

  try {
    const storedHandle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);

    if (isDirectoryHandle(storedHandle)) {
      const handle = storedHandle as any;
      const permission = await handle.queryPermission({
        mode: "readwrite",
      });

      const effectivePermission =
        permission === "granted"
          ? "granted"
          : await probeHandleAccess(handle, permission);

      return {
        type: "local",
        permission: effectivePermission,
        name: handle.name,
      };
    }
  } catch (err) {
    console.warn("Failed to check storage status:", err);
  }

  return { type: "opfs", permission: "granted", name: "OPFS" };
}
