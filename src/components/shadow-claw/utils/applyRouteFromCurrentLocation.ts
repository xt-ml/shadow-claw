import { parseRouteFromUrl } from "../../../core/app-routes.js";
import { applyRoute } from "./applyRoute.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function applyRouteFromCurrentLocation(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase | null,
  fStore: FileViewerStore,
  oStore: OrchestratorStore,
  url: URL,
): Promise<void> {
  const parsed = parseRouteFromUrl(url, oStore.activeGroupId);
  if (!parsed) {
    return;
  }

  await applyRoute(shadow, shadowClaw, db, fStore, oStore, parsed);
}
