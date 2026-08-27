import { CONFIG_KEYS } from "../../../config/config.js";
import { setConfig } from "../../../db/setConfig.js";

import type { ShadowClawDatabase } from "../../../db/types.js";

export async function persistChatSplitHeight(
  db: ShadowClawDatabase,
  px: number,
): Promise<void> {
  if (!db) {
    return;
  }

  try {
    await setConfig(db, CONFIG_KEYS.CHAT_SPLIT_VIEW_HEIGHT, px);
  } catch {
    // Ignore persistence failures so resize remains usable in degraded test/runtime states.
  }
}
