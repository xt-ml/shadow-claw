import { copyGroupEntry } from "./copyGroupEntry.js";
import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Move (rename and/or relocate) a file or directory in a group's workspace.
 */
export async function moveGroupEntry(
  db: ShadowClawDatabase,
  groupId: string,
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  const normSource = sourcePath.replace(/\/$/, "");
  const normTarget = targetPath.replace(/\/$/, "");

  if (normSource === normTarget) {
    return; // No-op
  }

  // 1. Copy source to target
  await copyGroupEntry(db, groupId, normSource, normTarget);

  // 2. Remove source
  const { dirs, filename } = parsePath(normSource);
  if (!filename) {
    throw new Error("Invalid source path");
  }

  const groupDir = await getGroupDir(db, groupId);
  let parentDir = groupDir;
  for (const seg of dirs) {
    parentDir = await parentDir.getDirectoryHandle(seg);
  }

  await parentDir.removeEntry(filename, { recursive: true });
}
