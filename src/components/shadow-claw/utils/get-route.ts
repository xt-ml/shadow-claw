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

  const destinationState =
    typeof navigateEvent?.destination?.getState === "function"
      ? navigateEvent.destination.getState()
      : null;
  const navState =
    destinationState ||
    (navigateEvent.navigationType === "replace" &&
    typeof history !== "undefined"
      ? history.state
      : null);
  if (
    navState?.inFeedScroll ||
    navState?.scrollSpy ||
    navState?.suppressRouter
  ) {
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
