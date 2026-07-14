import { parseRouteFromUrl } from "../../../core/app-routes.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";

export function getRoute(
  db: ShadowClawDatabase,
  oStore: OrchestratorStore,
  ev: Event,
) {
  if (!db) {
    return;
  }

  const navigateEvent = ev as any;
  if (navigateEvent.navigationType === "reload") {
    return;
  }

  const destinationUrl = navigateEvent?.destination?.url;
  if (typeof destinationUrl !== "string") {
    return;
  }

  const parsedUrl = new URL(destinationUrl);
  if (parsedUrl.origin !== window.location.origin) {
    return;
  }

  return {
    route: parseRouteFromUrl(parsedUrl, oStore.activeGroupId),
    navigateEvent,
  };
}
