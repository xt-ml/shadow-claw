import { CONFIG_KEYS } from "../config/config.js";
import { getConfig } from "./getConfig.js";
import { setConfig } from "./setConfig.js";

import type { ShadowClawDatabase } from "./types.js";

function createSubscriberId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Get the persisted per-browser subscriber ID, creating one on first use.
 */
export async function getOrCreateSubscriberId(
  db: ShadowClawDatabase,
): Promise<string> {
  if (!db) {
    return createSubscriberId();
  }

  const existing = await getConfig(db, CONFIG_KEYS.SUBSCRIBER_ID);
  if (typeof existing === "string" && existing.trim().length > 0) {
    return existing;
  }

  const created = createSubscriberId();
  await setConfig(db, CONFIG_KEYS.SUBSCRIBER_ID, created);

  return created;
}
