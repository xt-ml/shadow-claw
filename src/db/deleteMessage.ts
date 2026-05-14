import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Delete a message from the database by ID
 */
export function deleteMessage(
  db: ShadowClawDatabase,
  id: string,
): Promise<void> {
  return txPromise(db, "messages", "readwrite", (store) =>
    store.delete(id),
  ).then(() => undefined);
}
