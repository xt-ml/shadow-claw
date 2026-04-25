import { txPromise } from "./txPromise.js";
import type { Task, ShadowClawDatabase } from "../types.js";

/**
 * Save a task to the database
 */
export function saveTask(db: ShadowClawDatabase, task: Task): Promise<void> {
  // Store `enabled` as 0/1 so the IndexedDB 'by-enabled' index works
  const record = { ...task, enabled: task.enabled ? 1 : 0 };

  return txPromise(db, "tasks", "readwrite", (store) => store.put(record)).then(
    () => undefined,
  );
}
