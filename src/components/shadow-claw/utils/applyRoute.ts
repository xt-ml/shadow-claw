import { DEFAULT_GROUP_ID } from "../../../config/config.js";
import { applyBasePath, buildRoutePath } from "../../../core/app-routes.js";

import { applyAnchorWithRetry } from "./applyAnchorWithRetry.js";
import { historyState } from "./historyState.js";
import { showPage } from "./showPage.js";

import type { ShadowClawAppRoute } from "../../../core/app-routes.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function applyRoute(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  db: IDBDatabase | null,
  fStore: FileViewerStore,
  oStore: OrchestratorStore,
  route: ShadowClawAppRoute,
  options: { replace?: boolean } = { replace: false },
) {
  if (options.replace) {
    const targetPath = buildRoutePath(route);
    const finalPath = applyBasePath(targetPath);

    if (finalPath !== window.location.pathname) {
      historyState(globalThis.history, finalPath, {
        ...options,
        useTrailingSlash: false,
      });
    }
  }

  const { page, groupId, path, anchor } = route;
  if (!db) {
    return;
  }

  const resolvedPage = page ? String(page).toLowerCase() : "";

  if (resolvedPage && fStore.file) {
    const targetIsSameFile =
      resolvedPage === "files" &&
      path &&
      path === fStore.file.path &&
      (!groupId || groupId === oStore.activeGroupId);

    if (!targetIsSameFile) {
      const viewer = shadow?.querySelector("shadow-claw-file-viewer") as any;
      if (viewer && typeof viewer.requestCloseViewer === "function") {
        const closed = await viewer.requestCloseViewer();
        if (!closed) {
          return;
        }
      } else {
        fStore.closeFile();
      }
    }
  }

  if (groupId && groupId !== oStore.activeGroupId) {
    await oStore.switchConversation(db, groupId, resolvedPage === "chat");
  } else if (groupId) {
    // groupId matches the currently active group (restored from last session),
    // but content may not have loaded yet — ensure it is present.
    void oStore.loadHistory();
    if (resolvedPage === "tasks" || resolvedPage === "files") {
      if (db) {
        void oStore.loadFiles(db);
      }
    }
  }

  if (resolvedPage) {
    showPage(shadow, shadowClaw, db, oStore, resolvedPage);
  }

  if (resolvedPage === "files" && path) {
    const hasExtension = /\.[^./]+$/u.test(path);
    if (hasExtension) {
      try {
        await fStore.openFile(db, path, groupId || oStore.activeGroupId);
        if (anchor) {
          await applyAnchorWithRetry(() => {
            const viewer = shadow?.querySelector(
              "shadow-claw-file-viewer",
            ) as any;
            if (viewer && typeof viewer.handleAnchorNavigation === "function") {
              return !!viewer.handleAnchorNavigation(anchor);
            }

            return false;
          });
        }
      } catch (err) {
        console.error("Failed to open file via route navigation:", path, err);
      }
    } else {
      try {
        await oStore.setCurrentPath(db, path);
        fStore.closeFile();
      } catch (err) {
        console.error("Failed to open folder via route navigation:", path, err);
      }
    }
  }

  if (resolvedPage === "pages" && path) {
    const pagesComp = shadow?.querySelector("shadow-claw-pages") as any;
    if (pagesComp) {
      pagesComp.selectedPage = {
        groupId: groupId || oStore.activeGroupId || DEFAULT_GROUP_ID,
        path: path,
      };
      await pagesComp.renderSelectedPage();
      if (anchor) {
        await applyAnchorWithRetry(() => {
          if (typeof pagesComp.handleAnchorNavigation === "function") {
            return !!pagesComp.handleAnchorNavigation(anchor);
          }

          return false;
        });
      }
    }
  }
}
