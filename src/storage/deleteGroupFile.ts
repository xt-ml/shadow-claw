import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import { setMainGroupMemorySuppressed } from "./ensureMainGroupMemory.js";
import { setMainGroupIndexSuppressed } from "./ensureMainGroupIndex.js";
import { DEFAULT_GROUP_ID } from "../config/config.js";
import { orchestratorStore } from "../stores/orchestrator.js";
import { suppressPage } from "./suppressedPages.js";
import type { ShadowClawDatabase } from "../db/types.js";

/**
 * Delete a file from a group's workspace.
 */
export async function deleteGroupFile(
  db: ShadowClawDatabase,
  groupId: string,
  filePath: string,
): Promise<void> {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  await dir.removeEntry(filename);

  if (groupId === DEFAULT_GROUP_ID && dirs.length === 0) {
    if (filename === "MEMORY.md") {
      await setMainGroupMemorySuppressed(db, true);
    } else if (filename === "index.html") {
      await setMainGroupIndexSuppressed(db, true);
    }
  }

  try {
    await suppressPage(db, groupId, filePath);
  } catch {}

  try {
    await orchestratorStore.removePage(db, filePath, groupId);
  } catch {
    // Orchestrator store might not be instantiated in isolated storage unit test
  }
}
