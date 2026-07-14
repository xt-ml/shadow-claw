import { CONFIG_KEYS } from "../../../config/config.js";
import { getConfig } from "../../../db/getConfig.js";
import {
  DEFAULT_SIDEBAR_WIDTH_PX,
  MIN_SIDEBAR_WIDTH_PX,
} from "../shadow-claw.js";
import { clampSidebarWidth } from "./clampSidebarWidth.js";
import { persistSidebarWidth } from "./persistSidebarWidth.js";
import { setSidebarWidth } from "./setSidebarWidth.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function initSidebarResize(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  sidebar: HTMLElement,
  db: ShadowClawDatabase,
): Promise<void> {
  if (!shadow) {
    return;
  }

  const handle = shadow.querySelector(".sidebar-resize-handle");
  if (!(handle instanceof HTMLElement)) {
    return;
  }

  handle.setAttribute("tabindex", "0");
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", "Resize sidebar width");

  const getCurrentWidth = () => {
    const appBody = shadow.querySelector(".app-body");
    if (!(appBody instanceof HTMLElement)) {
      return DEFAULT_SIDEBAR_WIDTH_PX;
    }

    const stored = parseFloat(
      appBody.style.getPropertyValue("--sidebar-width"),
    );
    if (Number.isFinite(stored) && stored > 0) {
      return stored;
    }

    return sidebar.getBoundingClientRect().width || DEFAULT_SIDEBAR_WIDTH_PX;
  };

  const updateAria = () => {
    const current = Math.round(clampSidebarWidth(shadow, getCurrentWidth()));
    const max = Math.round(clampSidebarWidth(shadow, Number.MAX_SAFE_INTEGER));
    handle.setAttribute("aria-valuemin", String(MIN_SIDEBAR_WIDTH_PX));
    handle.setAttribute("aria-valuemax", String(max));
    handle.setAttribute("aria-valuenow", String(current));
  };

  try {
    const saved = db
      ? await getConfig(db, CONFIG_KEYS.SIDEBAR_WIDTH)
      : undefined;

    if (typeof saved === "number" && Number.isFinite(saved) && saved > 0) {
      setSidebarWidth(shadow, saved);
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
    const nextWidth = startWidth + delta;
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
      const value = parseFloat(
        appBody.style.getPropertyValue("--sidebar-width"),
      );
      if (Number.isFinite(value) && value > 0) {
        void persistSidebarWidth(db, value);
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
    startWidth = sidebar.getBoundingClientRect().width;
    handle.classList.add("active");

    handle.setPointerCapture(event.pointerId);
    document.addEventListener("pointermove", onPointerMove);
  });

  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("dblclick", () => {
    setSidebarWidth(shadow, DEFAULT_SIDEBAR_WIDTH_PX);
    void persistSidebarWidth(db, DEFAULT_SIDEBAR_WIDTH_PX);
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
      next = current + step;
    } else if (event.key === "ArrowLeft") {
      next = current - step;
    } else if (event.key === "Home") {
      next = MIN_SIDEBAR_WIDTH_PX;
    } else if (event.key === "End") {
      next = clampSidebarWidth(shadow, Number.MAX_SAFE_INTEGER);
    }

    if (next === null) {
      return;
    }

    event.preventDefault();
    setSidebarWidth(shadow, next);
    updateAria();
    void persistSidebarWidth(db, clampSidebarWidth(shadow, getCurrentWidth()));
  });

  updateAria();

  shadowClaw.addCleanup(() => {
    stopResize();
    handle.removeEventListener("pointerup", onPointerUp);
    handle.removeEventListener("pointercancel", stopResize);
  });
}
