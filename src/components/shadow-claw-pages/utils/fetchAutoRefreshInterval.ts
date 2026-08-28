import type { ShadowClawDatabase } from "../../../db/types.js";
import { getConfig } from "../../../db/getConfig.js";
import { CONFIG_KEYS } from "../../../config/config.js";
import { parseAutoRefreshInterval } from "./parseAutoRefreshInterval.js";

/**
 * Fetches and parses the auto-refresh interval configuration from IndexedDB.
 */
export async function fetchAutoRefreshInterval(
  db: ShadowClawDatabase | null,
  getConfigFn: typeof getConfig = getConfig,
): Promise<number> {
  if (!db) {
    return 0;
  }

  try {
    const stored = await getConfigFn(
      db,
      CONFIG_KEYS.PAGES_AUTO_REFRESH_INTERVAL,
    );
    return parseAutoRefreshInterval(stored);
  } catch {
    return 0;
  }
}
