import { getGroupDir } from "./getGroupDir.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Get the workspace subdirectory for a group.
 */
export async function getWorkspaceDir(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<FileSystemDirectoryHandle> {
  const groupDir = await getGroupDir(db, groupId);

  return groupDir.getDirectoryHandle("workspace", { create: true });
}
