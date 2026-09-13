import { openDatabase } from "./openDatabase.js";
import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase, Task } from "./types.js";

/**
 * Get a task by ID.
 *
 * Accepts an optional `db` parameter for headless/SQLite usage. When omitted,
 * falls back to the singleton `openDatabase()` (browser IDB path).
 */
export async function getTask(
  dbOrId: ShadowClawDatabase | string,
  maybeId?: string,
): Promise<Task | undefined> {
  let db: ShadowClawDatabase;
  let id: string;

  if (typeof dbOrId === "string") {
    db = await openDatabase();
    id = dbOrId;
  } else {
    db = dbOrId ?? (await openDatabase());
    id = maybeId!;
  }

  return txPromise<any>(db, "tasks", "readonly", (store) => store.get(id)).then(
    (t) => (t ? { ...t, enabled: !!t.enabled } : undefined),
  );
}
