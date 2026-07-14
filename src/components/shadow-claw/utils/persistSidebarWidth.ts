import { CONFIG_KEYS } from "../../../config/config.js";
import { setConfig } from "../../../db/setConfig.js";

import type { ShadowClawDatabase } from "../../../db/db.js";

export async function persistSidebarWidth(
  db: ShadowClawDatabase,
  px: number,
): Promise<void> {
  if (!db) {
    return;
  }

  try {
    await setConfig(db, CONFIG_KEYS.SIDEBAR_WIDTH, px);
  } catch {
    // Ignore persistence failures so resize remains usable in degraded test/runtime states.
  }
}
