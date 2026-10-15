import { getGroupDir } from "./get-group-dir.js";
import { parsePath } from "./parse-path.js";
import { setMainGroupMemorySuppressed } from "./ensure-main-group-memory.js";
import { setMainGroupIndexSuppressed } from "./ensure-main-group-index.js";
import { DEFAULT_GROUP_ID } from "../config/config.js";
import { orchestratorStore } from "../stores/orchestrator.js";
import { suppressPage } from "./suppressed-pages.js";
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
