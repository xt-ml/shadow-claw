import { CONFIG_KEYS } from "../config.js";
import { getConfig } from "../db/getConfig.js";
import type { ShadowClawDatabase } from "../types.js";

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
    typeof handle.getFileHandle === "function" &&
    typeof handle.requestPermission === "function"
  );
}

/**
 * Request storage handle permission if needed.
 */
export async function requestStorageAccess(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const handle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
  if (isDirectoryHandle(handle)) {
    const status = await (handle as any).requestPermission({
      mode: "readwrite",
    });

    return status === "granted";
  }

  return true; // No handle means OPFS, which always has "access"
}
