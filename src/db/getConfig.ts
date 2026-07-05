import { txPromise } from "./txPromise.js";
import type { ConfigEntry, ShadowClawDatabase } from "./types.js";

/**
 * Get a config value
 */
export function getConfig(
  db: ShadowClawDatabase,
  key: string,
): Promise<string | undefined> {
  return txPromise<ConfigEntry>(db, "config", "readonly", (store) =>
    store.get(key),
  ).then((entry) => entry?.value);
}
