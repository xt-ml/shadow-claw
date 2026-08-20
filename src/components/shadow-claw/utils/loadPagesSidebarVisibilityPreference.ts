import { loadAllSidebarVisibilityPreferences } from "./sidebarVisibility.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function loadPagesSidebarVisibilityPreference(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  oStore: OrchestratorStore,
  db: ShadowClawDatabase,
): Promise<void> {
  await loadAllSidebarVisibilityPreferences(shadow, shadowClaw, oStore, db);
}
