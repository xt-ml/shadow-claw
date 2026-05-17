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
 * Copy a file or directory in a group's workspace to a new path.
 */
export async function copyGroupEntry(
  db: ShadowClawDatabase,
  groupId: string,
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  const normSource = sourcePath.replace(/\/$/, "");
  const normTarget = targetPath.replace(/\/$/, "");

  if (normSource === normTarget) {
    throw new Error("Source and target paths are identical");
  }

  const { dirs: srcDirs, filename: srcName } = parsePath(normSource);
  const { dirs: tgtDirs, filename: tgtName } = parsePath(normTarget);

  if (!srcName || !tgtName) {
    throw new Error("Invalid path");
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const groupDir = await getGroupDir(db, groupId);

      // Resolve source parent
      let srcParent = groupDir;
      for (const seg of srcDirs) {
        srcParent = await srcParent.getDirectoryHandle(seg);
      }

      // Resolve target parent
      let tgtParent = groupDir;
      for (const seg of tgtDirs) {
        tgtParent = await tgtParent.getDirectoryHandle(seg, { create: true });
      }

      // Assert target does not exist
      if (
        (await tryGetFileHandle(tgtParent, tgtName)) ||
        (await tryGetDirectoryHandle(tgtParent, tgtName))
      ) {
        throw new Error(`Target already exists: ${tgtName}`);
      }

      // Check if source is a directory
      const sourceDir = await tryGetDirectoryHandle(srcParent, srcName);
      if (sourceDir) {
        const targetDir = await tgtParent.getDirectoryHandle(tgtName, {
          create: true,
        });

        await copyDirectoryContents(sourceDir, targetDir);

        return;
      }

      // Check if source is a file
      const sourceFile = await tryGetFileHandle(srcParent, srcName);
      if (sourceFile) {
        const file = await sourceFile.getFile();
        const targetFile = await tgtParent.getFileHandle(tgtName, {
          create: true,
        });

        try {
          await writeFileHandle(targetFile, file);
        } catch (writeErr) {
          const message =
            writeErr instanceof Error ? writeErr.message : String(writeErr);
          const needsOpfsWorkerFallback =
            message.includes("Writable file streams are not supported") &&
            (await getStorageStatus(db)).type === "opfs";

          if (!needsOpfsWorkerFallback) {
            await tgtParent.removeEntry(tgtName).catch(() => undefined);

            throw writeErr;
          }

          const safeId = groupId.replace(/:/g, "-");
          await writeOpfsPathViaWorker(
            [OPFS_ROOT, "groups", safeId, ...tgtDirs, tgtName],
            file,
          );
        }

        return;
      }

      throw new Error(`Entry not found: ${sourcePath}`);
    } catch (err) {
      if (attempt === 0 && isStaleHandleError(err)) {
        invalidateStorageRoot();

        continue;
      }

      throw err;
    }
  }
}

async function tryGetDirectoryHandle(
  parentDir: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await parentDir.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

async function tryGetFileHandle(
  parentDir: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemFileHandle | null> {
  try {
    return await parentDir.getFileHandle(name);
  } catch {
    return null;
  }
}

async function copyDirectoryContents(
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name, handle] of (sourceDir as any).entries()) {
    if (handle.kind === "directory") {
      const nextTargetDir = await targetDir.getDirectoryHandle(name, {
        create: true,
      });
      await copyDirectoryContents(handle, nextTargetDir);

      continue;
    }

    const file = await handle.getFile();
    const targetFileHandle = await targetDir.getFileHandle(name, {
      create: true,
    });
    await writeFileHandle(targetFileHandle, file);
  }
}
