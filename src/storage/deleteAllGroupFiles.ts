import { getGroupDir } from "./getGroupDir.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Recursively delete all files and directories in a group's workspace.
 */
export async function deleteAllGroupFiles(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<void> {
  const groupDir = await getGroupDir(db, groupId);

  // Delete everything in the group directory
  for await (const [name] of (groupDir as any).entries()) {
    await groupDir.removeEntry(name, { recursive: true });
  }
}
