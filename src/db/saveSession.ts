import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase, Session } from "../types.js";

/**
 * Save a session
 */
export function saveSession(
  db: ShadowClawDatabase,
  session: Session,
): Promise<void> {
  return txPromise(db, "sessions", "readwrite", (store) =>
    store.put(session),
  ).then(() => undefined);
}
