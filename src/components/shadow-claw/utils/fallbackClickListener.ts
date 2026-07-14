import { ShadowClawDatabase } from "../../../db/types.js";
import { FileViewerStore } from "../../../stores/file-viewer.js";
import { OrchestratorStore } from "../../../stores/orchestrator.js";
import { ShadowClaw } from "../shadow-claw.js";
import { applyRouteFromCurrentLocation } from "./applyRouteFromCurrentLocation.js";
import { historyState } from "./historyState.js";

export const fallbackClickListener =
  (
    shadow: ShadowRoot | null,
    shadowClaw: ShadowClaw,
    db: ShadowClawDatabase,
    fStore: FileViewerStore,
    oStore: OrchestratorStore,
    url: URL,
  ) =>
  (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const path = event.composedPath();
    let link: HTMLAnchorElement | null = null;
    for (const el of path) {
      if (el instanceof HTMLAnchorElement) {
        link = el;

        break;
      }
    }

    if (!link) {
      return;
    }

    const href = link.getAttribute("href") || "";
    if (
      !href ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      return;
    }

    if (link.target && link.target !== "_self") {
      return;
    }

    if (link.origin !== window.location.origin) {
      return;
    }

    if (
      link.pathname === window.location.pathname &&
      link.search === window.location.search &&
      link.hash !== window.location.hash
    ) {
      return;
    }

    event.preventDefault();
    const targetPath = `${link.pathname}${link.search}${link.hash}`;

    historyState(globalThis.history, targetPath, {
      replace: false,
      useTrailingSlash: false,
    });

    applyRouteFromCurrentLocation(shadow, shadowClaw, db, fStore, oStore, url);
  };
