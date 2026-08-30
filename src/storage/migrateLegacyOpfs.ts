import { CONFIG_KEYS, LEGACY_OPFS_ROOT } from "../config/config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { getOpfsRootDirName } from "./storage.js";
import { writeFileHandle, writeOpfsPathViaWorker } from "./writeFileHandle.js";
import type { ShadowClawDatabase } from "../db/types.js";

/**
 * Recursively copy entries from a source OPFS directory to a target OPFS directory.
 */
async function copyOpfsEntriesRecursively(
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
  pathSegments: string[],
): Promise<void> {
  for await (const [name, handle] of (sourceDir as any).entries()) {
    if (handle.kind === "directory") {
      const nextTargetDir = await targetDir.getDirectoryHandle(name, {
        create: true,
      });
      await copyOpfsEntriesRecursively(handle, nextTargetDir, [
        ...pathSegments,
        name,
      ]);
    } else if (handle.kind === "file") {
      const file = await handle.getFile();
      const targetFileHandle = await targetDir.getFileHandle(name, {
        create: true,
      });

      try {
        await writeFileHandle(targetFileHandle, file);
      } catch (writeErr) {
        const message =
          writeErr instanceof Error ? writeErr.message : String(writeErr);
        const needsOpfsWorkerFallback = message.includes(
          "Writable file streams are not supported",
        );

        if (!needsOpfsWorkerFallback) {
          throw writeErr;
        }

        await writeOpfsPathViaWorker([...pathSegments, name], file);
      }
    }
  }
}

/**
 * Perform a one-time migration of OPFS workspace files and directories from the
 * legacy unnamespaced root directory ("shadowclaw") to the active namespaced
 * deployment root directory if not already done.
 */
export async function migrateLegacyOpfs(db: ShadowClawDatabase): Promise<void> {
  if (!db) {
    return;
  }

  try {
    const alreadyMigrated = await getConfig(
      db,
      CONFIG_KEYS.OPFS_MIGRATED_FROM_LEGACY,
    );
    if (alreadyMigrated === "true") {
      return;
    }
  } catch {
    // ignore read error
  }

  const targetRootName = getOpfsRootDirName();
  if (targetRootName === LEGACY_OPFS_ROOT) {
    return;
  }

  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.getDirectory !== "function"
  ) {
    return;
  }

  try {
    const opfsRoot = await navigator.storage.getDirectory();
    let legacyRootHandle: FileSystemDirectoryHandle;

    try {
      legacyRootHandle = await opfsRoot.getDirectoryHandle(LEGACY_OPFS_ROOT);
    } catch {
      // Legacy OPFS folder does not exist (fresh installation or already cleaned up)
      try {
        await setConfig(db, CONFIG_KEYS.OPFS_MIGRATED_FROM_LEGACY, "true");
      } catch {
        // ignore write error
      }
      return;
    }

    const targetRootHandle = await opfsRoot.getDirectoryHandle(targetRootName, {
      create: true,
    });

    await copyOpfsEntriesRecursively(legacyRootHandle, targetRootHandle, [
      targetRootName,
    ]);
  } catch (err) {
    console.warn("Legacy OPFS migration warning:", err);
  } finally {
    try {
      await setConfig(db, CONFIG_KEYS.OPFS_MIGRATED_FROM_LEGACY, "true");
    } catch {
      // ignore write error
    }
  }
}
