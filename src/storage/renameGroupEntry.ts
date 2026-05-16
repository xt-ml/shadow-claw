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
 * Rename a file or directory in a group's workspace.
 */
export async function renameGroupEntry(
  db: ShadowClawDatabase,
  groupId: string,
  entryPath: string,
  newName: string,
): Promise<void> {
  const trimmedName = newName.trim();
  if (!trimmedName) {
    throw new Error("Name is required");
  }

  if (trimmedName.includes("/") || trimmedName.includes("\\")) {
    throw new Error("Name must not contain path separators");
  }

  const normalizedPath = entryPath.replace(/\/$/, "");
  const { dirs, filename: currentName } = parsePath(normalizedPath);

  if (!currentName) {
    throw new Error("Invalid path");
  }

  if (currentName === trimmedName) {
    return;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const groupDir = await getGroupDir(db, groupId);
      let parentDir = groupDir;

      for (const seg of dirs) {
        parentDir = await parentDir.getDirectoryHandle(seg);
      }

      await assertTargetDoesNotExist(parentDir, trimmedName);

      const sourceDir = await tryGetDirectoryHandle(parentDir, currentName);
      if (sourceDir) {
        const targetDir = await parentDir.getDirectoryHandle(trimmedName, {
          create: true,
        });

        await copyDirectoryContents(sourceDir, targetDir);
        await parentDir.removeEntry(currentName, { recursive: true });

        return;
      }

      const sourceFile = await tryGetFileHandle(parentDir, currentName);
      if (sourceFile) {
        const file = await sourceFile.getFile();
        const targetFile = await parentDir.getFileHandle(trimmedName, {
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
            // Clean up the empty target file so retries don't see "Target already exists".
            await parentDir.removeEntry(trimmedName).catch(() => undefined);
            throw writeErr;
          }

          const safeId = groupId.replace(/:/g, "-");
          await writeOpfsPathViaWorker(
            [OPFS_ROOT, "groups", safeId, ...dirs, trimmedName],
            file,
          );
        }

        await parentDir.removeEntry(currentName);

        return;
      }

      throw new Error(`Entry not found: ${entryPath}`);
    } catch (err) {
      if (attempt === 0 && isStaleHandleError(err)) {
        invalidateStorageRoot();

        continue;
      }

      throw err;
    }
  }
}

async function assertTargetDoesNotExist(
  parentDir: FileSystemDirectoryHandle,
  newName: string,
): Promise<void> {
  if (
    (await tryGetFileHandle(parentDir, newName)) ||
    (await tryGetDirectoryHandle(parentDir, newName))
  ) {
    throw new Error(`Target already exists: ${newName}`);
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
