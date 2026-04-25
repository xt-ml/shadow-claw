import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Delete a config value
 */
export function deleteConfig(
  db: ShadowClawDatabase,
  key: string,
): Promise<void> {
  return txPromise(db, "config", "readwrite", (store) =>
    store.delete(key),
  ).then(() => undefined);
}
