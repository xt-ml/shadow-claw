import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase, Task } from "./types.js";

/**
 * Get all tasks
 */
export function getAllTasks(db: ShadowClawDatabase): Promise<Task[]> {
  return txPromise<any[]>(db, "tasks", "readonly", (store) =>
    store.getAll(),
  ).then((tasks) => tasks.map((t) => ({ ...t, enabled: !!t.enabled })));
}
