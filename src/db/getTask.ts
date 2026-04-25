import { openDatabase } from "./openDatabase.js";
import { txPromise } from "./txPromise.js";
import type { Task } from "../types.js";

/**
 * Get a task by ID
 */
export async function getTask(id: string): Promise<Task | undefined> {
  const db = await openDatabase();

  return txPromise<any>(db, "tasks", "readonly", (store) => store.get(id)).then(
    (t) => (t ? { ...t, enabled: !!t.enabled } : undefined),
  );
}
