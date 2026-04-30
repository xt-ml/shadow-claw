import { getGroupDir } from "./getGroupDir.js";
import { invalidateStorageRoot, isStaleHandleError } from "./storage.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * List files and directories in a group's workspace directory.
 */
export async function listGroupFiles(
  db: ShadowClawDatabase,
  groupId: string,
  dirPath: string = ".",
): Promise<string[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const groupDir = await getGroupDir(db, groupId);

      let dir = groupDir;
      if (dirPath && dirPath !== ".") {
        const parts = dirPath
          .replace(/\\/g, "/")
          .replace(/^\/home\/user\//, "/")
          .replace(/^\/+/, "")
          .split("/")
          .filter(Boolean);

        for (const seg of parts) {
          const child = await dir.getDirectoryHandle(seg);

          // Guard against stale handles where navigation returns the same directory
          if (
            typeof dir.isSameEntry === "function" &&
            (await dir.isSameEntry(child))
          ) {
            throw new Error(
              `Directory navigation stuck at "${dir.name}" for segment "${seg}" — ` +
                "the stored directory handle may be stale.",
            );
          }

          dir = child;
        }
      }

      const entries: string[] = [];
      for await (const [name, handle] of (dir as any).entries()) {
        entries.push(handle.kind === "directory" ? `${name}/` : name);
      }

      return entries.sort();
    } catch (err) {
      if (attempt === 0 && isStaleHandleError(err)) {
        invalidateStorageRoot();

        continue;
      }

      throw err;
    }
  }

  return [];
}
