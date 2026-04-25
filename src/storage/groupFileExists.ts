import { readGroupFile } from "./readGroupFile.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Check if a file exists in a group's workspace.
 */
export async function groupFileExists(
  db: ShadowClawDatabase,
  groupId: string,
  filePath: string,
): Promise<boolean> {
  try {
    await readGroupFile(db, groupId, filePath);

    return true;
  } catch {
    return false;
  }
}
