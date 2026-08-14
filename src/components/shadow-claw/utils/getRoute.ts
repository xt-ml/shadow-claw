import { isPossibleAppRoute } from "../../../core/app-routes.js";
import type { ShadowClawDatabase } from "../../../db/types.js";

export function getRoute(db: ShadowClawDatabase, ev: Event) {
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

  if (!isPossibleAppRoute(parsedUrl.pathname)) {
    return;
  }

  // We must return the URL and navigateEvent so the caller can lazily resolve
  return {
    parsedUrl,
    navigateEvent,
  };
}
