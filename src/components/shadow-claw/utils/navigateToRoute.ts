import { applyBasePath, buildRoutePath } from "../../../core/app-routes.js";
import { applyRoute } from "./applyRoute.js";
import { historyState } from "./historyState.js";
import { supportsNavigationApi } from "./supportsNavigationApi.js";

import type { ShadowClawAppRoute } from "../../../core/app-routes.js";
import type { ShadowClawDatabase } from "../../../db/types.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function navigateToRoute(
  shadow: ShadowRoot,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase,
  fStore: FileViewerStore,
  oStore: OrchestratorStore,
  route: ShadowClawAppRoute,
  options: { replace?: boolean } = { replace: false },
): Promise<void> {
  const targetPath = buildRoutePath(route);
  const finalPath = applyBasePath(targetPath);

  if (supportsNavigationApi()) {
    const nav = (window as any).navigation;

    nav.navigate(finalPath, {
      history: options.replace ? "replace" : "push",
    });

    return;
  }

  if (finalPath !== window.location.pathname) {
    historyState(globalThis.history, finalPath, {
      ...options,
      useTrailingSlash: false,
    });
  }

  await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);
}
