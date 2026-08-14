import { DEFAULT_GROUP_ID } from "../../../config/config.js";

import { applyAnchorWithRetry } from "./applyAnchorWithRetry.js";
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
) {
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

  if (resolvedPage === "pages") {
    // The pages component is lazy-loaded via a dynamic import that is
    // fire-and-forgotten from showPage(). On initial boot the import may
    // still be in-flight here, leaving the DSD-prerendered element in the
    // DOM but not yet upgraded. Awaiting whenDefined() guarantees the
    // element is fully upgraded before clearBootPendingClass() fires —
    // regardless of whether a specific page path is in the URL. The upgrade
    // synchronously runs the connectedCallback() preamble which clears stale
    // SSR content, so the first visible frame after boot always shows CSR.
    if (typeof customElements !== "undefined") {
      await customElements.whenDefined("shadow-claw-pages");
    }

    // When a specific path is in the URL, pin it before rendering.
    if (path) {
      await oStore.setActivePinnedPage(db, {
        groupId: groupId || oStore.activeGroupId || DEFAULT_GROUP_ID,
        path: path,
      });
    } else {
      const defaultPage =
        oStore.effectiveDefaultPage ||
        (oStore.pages && oStore.pages[0]) ||
        null;
      if (defaultPage) {
        await oStore.setActivePinnedPage(db, defaultPage);
      }
    }

    // Always render the active pinned page (either just-set from path, or the
    // persisted default page).
    const pagesComp = shadow?.querySelector("shadow-claw-pages") as any;
    if (pagesComp && typeof pagesComp.renderSelectedPage === "function") {
      await pagesComp.renderSelectedPage();
      if (typeof pagesComp.setupAutoRefreshTimer === "function") {
        void pagesComp.setupAutoRefreshTimer();
      }
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
