import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase, Session } from "../types.js";

/**
 * Get session for a group
 */
export function getSession(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<Session | undefined> {
  return txPromise<Session | undefined>(db, "sessions", "readonly", (store) =>
    store.get(groupId),
  );
}
