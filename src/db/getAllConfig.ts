import { openDatabase } from "./openDatabase.js";
import { txPromise } from "./txPromise.js";
import type { ConfigEntry } from "../types.js";

/**
 * Get all config entries
 */
export async function getAllConfig(): Promise<ConfigEntry[]> {
  const db = await openDatabase();

  return txPromise<ConfigEntry[]>(db, "config", "readonly", (store) =>
    store.getAll(),
  );
}
