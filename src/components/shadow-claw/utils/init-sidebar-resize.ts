import { CONFIG_KEYS } from "../../../config/config.js";
import { getConfig } from "../../../db/get-config.js";

import {
  DEFAULT_SIDEBAR_WIDTH_PX,
  MIN_SIDEBAR_WIDTH_PX,
  SIDEBAR_COLLAPSED_WIDTH_PX,
} from "../constants.js";

import { clampSidebarWidth } from "./clamp-sidebar-width.js";
import { persistSidebarWidth } from "./persist-sidebar-width.js";
import { setSidebarWidth } from "./set-sidebar-width.js";

import type { ShadowClawDatabase } from "../../../db/db.js";

interface SidebarResizeHost {
  addCleanup: (fn: () => void) => void;
}

export async function initSidebarResize(
  shadow: ShadowRoot | null,
  shadowClaw: SidebarResizeHost,
  sidebar: HTMLElement,
  db: ShadowClawDatabase | undefined,
): Promise<void> {
  if (!shadow) {
    return;
  }

  const handle = shadow.querySelector(".sidebar-resize-handle");
  if (!(handle instanceof HTMLElement)) {
    return;
  }

  if (sidebar instanceof HTMLElement && !sidebar.id) {
    sidebar.id = "sidebar";
  }

  handle.setAttribute("tabindex", "0");
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-controls", sidebar?.id || "sidebar");
  handle.setAttribute("aria-label", "Resize sidebar width");

  let lastExpandedWidth = DEFAULT_SIDEBAR_WIDTH_PX;

  const getCurrentWidth = () => {
    const appBody = shadow.querySelector(".app-body");
    if (!(appBody instanceof HTMLElement)) {
      return DEFAULT_SIDEBAR_WIDTH_PX;
    }

    const stored = parseFloat(
      appBody.style.getPropertyValue("--sidebar-width"),
    );
    if (Number.isFinite(stored) && stored >= 0) {
      return stored;
    }

    return sidebar.getBoundingClientRect().width || DEFAULT_SIDEBAR_WIDTH_PX;
  };

  const updateAria = () => {
    const rawWidth = getCurrentWidth();
    const isCollapsed =
      !Number.isFinite(rawWidth) || rawWidth < MIN_SIDEBAR_WIDTH_PX;
    const current = isCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH_PX
      : Math.round(clampSidebarWidth(shadow, rawWidth));
    const max = Math.round(clampSidebarWidth(shadow, Number.MAX_SAFE_INTEGER));
    if (!isCollapsed && Number.isFinite(current)) {
      lastExpandedWidth = current;
    }
    handle.setAttribute("aria-valuemin", String(SIDEBAR_COLLAPSED_WIDTH_PX));
    handle.setAttribute("aria-valuemax", String(max));
    handle.setAttribute("aria-valuenow", String(current));
    handle.setAttribute(
      "aria-valuetext",
      isCollapsed ? "Collapsed (0px)" : `${current}px`,
    );
    handle.title = isCollapsed
      ? "Drag or double-click to expand sidebar"
      : "Drag to resize sidebar";
  };

  try {
    const saved = db
      ? await getConfig(db, CONFIG_KEYS.SIDEBAR_WIDTH)
      : undefined;

    const parsedSaved =
      typeof saved === "number"
        ? saved
        : typeof saved === "string"
          ? parseFloat(saved)
          : NaN;

    if (Number.isFinite(parsedSaved) && parsedSaved >= MIN_SIDEBAR_WIDTH_PX) {
      lastExpandedWidth = parsedSaved;
      setSidebarWidth(shadow, parsedSaved);
    } else {
      setSidebarWidth(shadow, DEFAULT_SIDEBAR_WIDTH_PX);
    }
  } catch {
    setSidebarWidth(shadow, DEFAULT_SIDEBAR_WIDTH_PX);
  }

  let activePointerId: number | null = null;
  let startX = 0;
  let startWidth = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    const delta = event.clientX - startX;
    const rawNextWidth = startWidth + delta;
    const wasCollapsed = getCurrentWidth() < MIN_SIDEBAR_WIDTH_PX;
    const willCollapse = rawNextWidth < MIN_SIDEBAR_WIDTH_PX;
    const nextWidth = willCollapse ? SIDEBAR_COLLAPSED_WIDTH_PX : rawNextWidth;

    const appBody = shadow.querySelector(".app-body");
    if (appBody instanceof HTMLElement) {
      if (wasCollapsed !== willCollapse || willCollapse) {
        appBody.classList.remove("sidebar-resizing");
      } else {
        appBody.classList.add("sidebar-resizing");
      }
    }

    setSidebarWidth(shadow, nextWidth);
    updateAria();
  };

  const stopResize = () => {
    if (activePointerId === null) {
      return;
    }

    activePointerId = null;
    handle.classList.remove("active");
    document.removeEventListener("pointermove", onPointerMove);

    const appBody = shadow.querySelector(".app-body");
    if (appBody instanceof HTMLElement) {
      appBody.classList.remove("sidebar-resizing");
      const value = parseFloat(
        appBody.style.getPropertyValue("--sidebar-width"),
      );
      if (Number.isFinite(value) && value >= MIN_SIDEBAR_WIDTH_PX) {
        lastExpandedWidth = value;
        if (db) {
          void persistSidebarWidth(db, value);
        }
      }
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    stopResize();
  };

  handle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0 &&
      event.button !== -1
    ) {
      return;
    }

    if (window.innerWidth < 896) {
      return;
    }

    event.preventDefault();
    activePointerId = event.pointerId;
    startX = event.clientX;
    const appBody = shadow.querySelector(".app-body");
    const storedWidth =
      appBody instanceof HTMLElement
        ? parseFloat(appBody.style.getPropertyValue("--sidebar-width"))
        : NaN;
    startWidth =
      Number.isFinite(storedWidth) && storedWidth >= 0
        ? storedWidth
        : sidebar.getBoundingClientRect().width;
    if (appBody instanceof HTMLElement) {
      appBody.classList.add("sidebar-resizing");
    }
    handle.classList.add("active");

    handle.setPointerCapture(event.pointerId);
    document.addEventListener("pointermove", onPointerMove);
  });

  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("dblclick", () => {
    setSidebarWidth(shadow, DEFAULT_SIDEBAR_WIDTH_PX);
    if (db) {
      void persistSidebarWidth(db, DEFAULT_SIDEBAR_WIDTH_PX);
    }

    updateAria();
  });

  handle.addEventListener("keydown", (event: KeyboardEvent) => {
    if (window.innerWidth < 896) {
      return;
    }

    const step = event.shiftKey ? 32 : 12;
    const current = getCurrentWidth();
    let next: number | null = null;

    if (event.key === "ArrowRight") {
      next =
        current < MIN_SIDEBAR_WIDTH_PX ? MIN_SIDEBAR_WIDTH_PX : current + step;
    } else if (event.key === "ArrowLeft") {
      const candidate = current - step;
      next =
        candidate < MIN_SIDEBAR_WIDTH_PX
          ? SIDEBAR_COLLAPSED_WIDTH_PX
          : candidate;
    } else if (event.key === "Home") {
      next = SIDEBAR_COLLAPSED_WIDTH_PX;
    } else if (event.key === "End") {
      next = clampSidebarWidth(shadow, Number.MAX_SAFE_INTEGER);
    } else if (event.key === "Enter" || event.key === " ") {
      if (current >= MIN_SIDEBAR_WIDTH_PX) {
        lastExpandedWidth = current;
        next = SIDEBAR_COLLAPSED_WIDTH_PX;
      } else {
        next =
          lastExpandedWidth >= MIN_SIDEBAR_WIDTH_PX
            ? lastExpandedWidth
            : DEFAULT_SIDEBAR_WIDTH_PX;
      }
    }

    if (next === null) {
      return;
    }

    event.preventDefault();
    setSidebarWidth(shadow, next);
    updateAria();
    if (db && next >= MIN_SIDEBAR_WIDTH_PX) {
      void persistSidebarWidth(
        db,
        clampSidebarWidth(shadow, getCurrentWidth()),
      );
    }
  });

  updateAria();

  shadowClaw.addCleanup(() => {
    stopResize();
    handle.removeEventListener("pointerup", onPointerUp);
    handle.removeEventListener("pointercancel", stopResize);
  });
}
