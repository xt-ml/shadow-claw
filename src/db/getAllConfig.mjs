import { txPromise } from "../db/txPromise.mjs";

/**
 * Get all config entries
 *
 * @returns {Promise<import('../types.mjs').ConfigEntry[]>}
 */
export function getAllConfig() {
  return txPromise("config", "readonly", (store) => store.getAll());
}
