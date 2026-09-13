import { ulid } from "../utils/ulid.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase } from "./types.js";

/**
 * Clone all tasks from one group to another, assigning new IDs.
 */
export function cloneGroupTasks(
  db: ShadowClawDatabase,
  sourceGroupId: string,
  targetGroupId: string,
): Promise<number> {
  if (db && isSqliteDatabase(db)) {
    const raw = db.db;
    const rows = raw
      .prepare("SELECT * FROM tasks WHERE groupId = ?")
      .all(sourceGroupId) as any[];
    const stmt = raw.prepare(
      `INSERT INTO tasks
       (id, groupId, enabled, schedule, prompt, tools, lastRun, createdAt, type, freshContext, subagent, name, task_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      stmt.run(
        ulid(),
        targetGroupId,
        r.enabled ? 1 : 0,
        r.schedule ?? null,
        r.prompt ?? "",
        r.tools ?? null,
        r.lastRun ?? null,
        r.createdAt,
        r.type ?? null,
        r.freshContext ? 1 : null,
        r.subagent ? 1 : null,
        r.name ?? null,
        r.task_order ?? null,
      );
    }
    return Promise.resolve(rows.length);
  }

  return new Promise((resolve, reject) => {
    const idb = db as IDBDatabase;
    const tx = idb?.transaction("tasks", "readwrite");

    if (!tx) {
      throw new Error("failed to get transaction, cannot clone tasks.");
    }

    const store = tx.objectStore("tasks");
    const index = store.index("by-group");
    const request = index.openCursor(sourceGroupId);
    let count = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const clone = { ...cursor.value, id: ulid(), groupId: targetGroupId };
        store.put(clone);
        count++;
        cursor.continue();
      } else {
        resolve(count);
      }
    };

    request.onerror = () => reject(request.error);
  });
}
