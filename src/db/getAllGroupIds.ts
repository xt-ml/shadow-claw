import { openDatabase } from "./openDatabase.js";

/**
 * Get all group IDs from messages
 */
export async function getAllGroupIds(): Promise<string[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db?.transaction("messages", "readonly");

    if (!tx) {
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
