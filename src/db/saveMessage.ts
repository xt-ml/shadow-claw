import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase, StoredMessage } from "../types.js";

/**
 * Save a message to the database
 */
export function saveMessage(
  db: ShadowClawDatabase,
  msg: StoredMessage,
): Promise<void> {
  return txPromise(db, "messages", "readwrite", (store) => store.put(msg)).then(
    () => undefined,
  );
}
