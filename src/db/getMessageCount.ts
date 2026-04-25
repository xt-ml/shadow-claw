import { openDatabase } from "./openDatabase.js";

/**
 * Get message count for a group
 */
export async function getMessageCount(groupId: string): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db?.transaction("messages", "readonly");

    if (!tx) {
      return;
    }

    const store = tx.objectStore("messages");
    const index = store.index("by-group");
    const request = index.count(groupId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
