import { getGroupDir } from "./getGroupDir.js";
import { writeFileHandle } from "./writeFileHandle.js";
import type { ShadowClawDatabase } from "../types.js";

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

  await copyDirectoryContents(sourceDir, targetDir);
}

async function copyDirectoryContents(
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  // @ts-ignore - entries() is supported on File System Access directory handles.
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
