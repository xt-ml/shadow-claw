import { openDatabase } from "./openDatabase.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase } from "./types.js";

/**
 * Get all group IDs from messages
 */
export async function getAllGroupIds(
  optionalDb?: ShadowClawDatabase,
): Promise<string[]> {
  const db = optionalDb ?? (await openDatabase());

  if (isSqliteDatabase(db)) {
    const rows = db.db
      .prepare("SELECT DISTINCT groupId FROM messages ORDER BY groupId ASC")
      .all() as { groupId: string }[];
    return rows.map((r) => r.groupId);
  }

  return new Promise((resolve, reject) => {
    const tx = db?.transaction("messages", "readonly");

    if (!tx) {
      resolve([]);
      return;
    }

    const store = tx.objectStore("messages");
    const index = store.index("by-group");
    const request = index.openKeyCursor(null, "nextunique");

    const ids: string[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        ids.push(cursor.key as string);

        cursor.continue();
      } else {
        resolve(ids);
      }
    };

    request.onerror = () => reject(request.error);
  });
}
