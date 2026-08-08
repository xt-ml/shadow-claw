import { OPFS_ROOT } from "../config/config.js";
import { getGroupDir } from "./getGroupDir.js";
import { getStorageStatus } from "./storage.js";
import { writeFileHandle, writeOpfsPathViaWorker } from "./writeFileHandle.js";
import type { ShadowClawDatabase } from "../db/types.js";

/**
 * Copy a nested directory from one group workspace to another.
 */
export async function copyGroupDirectory(
  db: ShadowClawDatabase,
  sourceGroupId: string,
  targetGroupId: string,
  dirPath: string,
): Promise<void> {
  const sourceRoot = await getGroupDir(db, sourceGroupId);
  const targetRoot = await getGroupDir(db, targetGroupId);
  const parts = dirPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);

  let sourceDir = sourceRoot;
  let targetDir = targetRoot;

  for (const part of parts) {
    sourceDir = await sourceDir.getDirectoryHandle(part);
    targetDir = await targetDir.getDirectoryHandle(part, { create: true });
  }

  const safeTargetGroupId = targetGroupId.replace(/:/g, "-");
  const initialPathSegments = [
    OPFS_ROOT,
    "groups",
    safeTargetGroupId,
    ...parts,
  ];

  try {
    await copyDirectoryContents(
      db,
      targetGroupId,
      sourceDir,
      targetDir,
      initialPathSegments,
    );
  } catch (copyErr) {
    if (parts.length > 0) {
      await targetRoot
        .removeEntry(parts[0], { recursive: true })
        .catch(() => undefined);
    }
    throw copyErr;
  }
}

async function copyDirectoryContents(
  db: ShadowClawDatabase,
  targetGroupId: string,
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
  currentPathSegments: string[],
): Promise<void> {
  for await (const [name, handle] of (sourceDir as any).entries()) {
    if (handle.kind === "directory") {
      const nextTargetDir = await targetDir.getDirectoryHandle(name, {
        create: true,
      });
      await copyDirectoryContents(db, targetGroupId, handle, nextTargetDir, [
        ...currentPathSegments,
        name,
      ]);

      continue;
    }

    const file = await handle.getFile();
    const targetFileHandle = await targetDir.getFileHandle(name, {
      create: true,
    });

    try {
      await writeFileHandle(targetFileHandle, file);
    } catch (writeErr) {
      const message =
        writeErr instanceof Error ? writeErr.message : String(writeErr);
      const needsOpfsWorkerFallback =
        message.includes("Writable file streams are not supported") &&
        (await getStorageStatus(db)).type === "opfs";

      if (!needsOpfsWorkerFallback) {
        throw writeErr;
      }

      await writeOpfsPathViaWorker([...currentPathSegments, name], file);
    }
  }
}
