import { DEFAULT_GROUP_ID } from "../../../config/config.js";
import {
  applyBasePath,
  getAppBasePath,
  parseRouteFromUrlAsync,
  resolveDefaultPinnedPageRef,
  resolveRouteToPrettyPathAsync,
  type ShadowClawAppRoute,
} from "../../../core/app-routes.js";
import { getSiteConfigDefaultPinnedPage } from "../../../storage/staticMainSite.js";
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
  let pathname = url.pathname;
  const basePath = getAppBasePath();
  if (basePath !== "/" && pathname.startsWith(basePath)) {
    pathname = "/" + pathname.slice(basePath.length);
  }
  const parts = pathname.split("/").filter(Boolean);
  const isRoot =
    parts.length === 0 || (parts.length === 1 && parts[0] === "index.html");

  const defaultPinned =
    oStore.defaultPinnedPage ||
    resolveDefaultPinnedPageRef(getSiteConfigDefaultPinnedPage());

  if (isRoot && defaultPinned) {
    const targetGroup =
      defaultPinned.groupId || oStore.activeGroupId || DEFAULT_GROUP_ID;
    const defaultRoute: ShadowClawAppRoute = {
      page: "pages",
      groupId: targetGroup,
      path: defaultPinned.path,
    };

    const prettyPath = await resolveRouteToPrettyPathAsync(defaultRoute);
    if (
      prettyPath &&
      prettyPath !== "/" &&
      typeof window !== "undefined" &&
      window.history
    ) {
      const targetUrl = applyBasePath(prettyPath);
      window.history.replaceState(null, "", targetUrl);
    }

    await applyRoute(shadow, shadowClaw, db, fStore, oStore, defaultRoute);
    return;
  }

  const parsed = await parseRouteFromUrlAsync(url, oStore.activeGroupId);
  if (!parsed) {
    return;
  }

  await applyRoute(shadow, shadowClaw, db, fStore, oStore, parsed);
}
