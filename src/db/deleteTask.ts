import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Delete a task
 */
export function deleteTask(db: ShadowClawDatabase, id: string): Promise<void> {
  if (!id) {
    return Promise.reject(new Error("Task ID is required for deletion."));
  }

  return txPromise(db, "tasks", "readwrite", (store) => store.delete(id)).then(
    () => undefined,
  );
}
