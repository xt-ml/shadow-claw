import { navigateToRoute } from "./navigateToRoute.js";
import { normalizePageRoute } from "./normalizePageRoute.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClawNavigateDetail } from "../../../utils/utils.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function handleShadowClawNavigate(
  shadow: ShadowRoot,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase,
  fStore: FileViewerStore,
  oStore: OrchestratorStore,
  event: Event,
) {
  const customEvent = event as CustomEvent<ShadowClawNavigateDetail>;
  const detail = customEvent.detail;
  if (!detail) {
    return;
  }

  await navigateToRoute(shadow, shadowClaw, db, fStore, oStore, {
    page: normalizePageRoute(String(detail.page || "chat")),
    groupId: detail.groupId,
    path: detail.path,
    anchor: detail.anchor,
  });
}
