import { getSession } from "./getSession.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase } from "./types.js";
import type { ChatData } from "./importChatData.js";

/**
 * Export all chat data for a group (messages and session)
 */
export async function exportChatData(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<ChatData | null> {
  try {
    let messages: any[];

    if (db && isSqliteDatabase(db)) {
      const raw = db.db;
      messages = (raw
        .prepare(
          "SELECT * FROM messages WHERE groupId = ? ORDER BY timestamp ASC",
        )
        .all(groupId) ?? []) as any[];
    } else {
      const idb = db as IDBDatabase;
      const tx = idb?.transaction("messages", "readonly");
      if (!tx) {
        throw new Error("cannot get transaction to export chat data");
      }

      const store = tx.objectStore("messages");
      const index = store.index("by-group");
      messages = await new Promise<any[]>((resolve, reject) => {
        const request = index.getAll(groupId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    // Get session for this group
    const session = await getSession(db, groupId);

    return { messages, session };
  } catch (err) {
    console.error("Failed to export chat data:", err);

    return null;
  }
}
