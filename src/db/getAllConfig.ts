import { openDatabase } from "./openDatabase.js";
import { txPromise } from "./txPromise.js";
import type { ConfigEntry, ShadowClawDatabase } from "./types.js";

/**
 * Get all config entries.
 *
 * Accepts an optional `db` parameter for headless/SQLite usage.
 */
export async function getAllConfig(
  db?: ShadowClawDatabase,
): Promise<ConfigEntry[]> {
  const resolvedDb = db ?? (await openDatabase());
  return txPromise<ConfigEntry[]>(resolvedDb, "config", "readonly", (store) =>
    store.getAll(),
  );
}
