import { CONFIG_KEYS } from "../../../config/config.js";
import { getConfig } from "../../../db/getConfig.js";
import { parseConfigBoolean } from "./parseConfigBoolean.js";
import { setPagesSidebarHidden } from "./setPagesSidebarHidden.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function loadPagesSidebarVisibilityPreference(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  oStore: OrchestratorStore,
  db: ShadowClawDatabase,
): Promise<void> {
  if (!db) {
    setPagesSidebarHidden(shadow, shadowClaw, oStore, db, false);

    return;
  }

  try {
    const raw = await getConfig(db, CONFIG_KEYS.SIDEBAR_PAGES_HIDDEN);
    setPagesSidebarHidden(
      shadow,
      shadowClaw,
      oStore,
      db,
      parseConfigBoolean(raw),
    );
  } catch {
    setPagesSidebarHidden(shadow, shadowClaw, oStore, db, false);
  }
}
