import { ulid } from "../utils/ulid.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase } from "./types.js";

/**
 * Clone all messages from one group to another, assigning new IDs.
 */
export function cloneGroupMessages(
  db: ShadowClawDatabase,
  sourceGroupId: string,
  targetGroupId: string,
): Promise<number> {
  if (db && isSqliteDatabase(db)) {
    const raw = db.db;
    const rows = raw
      .prepare("SELECT * FROM messages WHERE groupId = ?")
      .all(sourceGroupId) as any[];
    const stmt = raw.prepare(
      `INSERT INTO messages
       (id, groupId, timestamp, content, sender, channel, isFromMe, isTrigger, attachments, a2uiAction, a2uiEnvelopes, freshContext, subagent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      stmt.run(
        ulid(),
        targetGroupId,
        r.timestamp,
        r.content,
        r.sender,
        r.channel ?? "chat",
        r.isFromMe,
        r.isTrigger,
        r.attachments,
        r.a2uiAction,
        r.a2uiEnvelopes,
        r.freshContext,
        r.subagent,
      );
    }
    return Promise.resolve(rows.length);
  }

  return new Promise((resolve, reject) => {
    const idb = db as IDBDatabase;
    const tx = idb?.transaction("messages", "readwrite");

    if (!tx) {
      throw new Error("failed to get transaction, cannot clone messages.");
    }

    const store = tx.objectStore("messages");
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
