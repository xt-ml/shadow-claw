import { ulid } from "../ulid.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Clone all tasks from one group to another, assigning new IDs.
 */
export function cloneGroupTasks(
  db: ShadowClawDatabase,
  sourceGroupId: string,
  targetGroupId: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db?.transaction("tasks", "readwrite");

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
