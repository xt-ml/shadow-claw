import { txPromise } from "./txPromise.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Set a config value
 */
export function setConfig(
  db: ShadowClawDatabase,
  key: string,
  value: any,
): Promise<void> {
  return txPromise(db, "config", "readwrite", (store) =>
    store.put({ key, value }),
  ).then(() => undefined);
}
