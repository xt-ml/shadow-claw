import { OPFS_ROOT } from "../config.js";
import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import {
  getStorageStatus,
  invalidateStorageRoot,
  isStaleHandleError,
} from "./storage.js";
import { writeFileHandle, writeOpfsPathViaWorker } from "./writeFileHandle.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Write content to a file in a group's workspace.
 * Creates intermediate directories as needed.
 */
export async function writeGroupFile(
  db: ShadowClawDatabase,
  groupId: string,
  filePath: string,
  content: string,
): Promise<void> {
  const { dirs, filename } = parsePath(filePath);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const groupDir = await getGroupDir(db, groupId);
      let dir = groupDir;
      for (const seg of dirs) {
        dir = await dir.getDirectoryHandle(seg, { create: true });
      }

      const fileHandle = await dir.getFileHandle(filename, { create: true });

      try {
        await writeFileHandle(fileHandle, content);

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
        content,
      );

      return;
    } catch (err) {
      if (attempt === 0 && isStaleHandleError(err)) {
        invalidateStorageRoot();

        continue;
      }

      throw err;
    }
  }
}
