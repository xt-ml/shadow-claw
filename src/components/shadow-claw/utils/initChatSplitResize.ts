import { CONFIG_KEYS } from "../../../config/config.js";
import { getConfig } from "../../../db/getConfig.js";

import {
  DEFAULT_CHAT_SPLIT_HEIGHT_PX,
  MIN_CHAT_SPLIT_HEIGHT_PX,
} from "../constants.js";

import { clampChatSplitHeight } from "./clampChatSplitHeight.js";
import { persistChatSplitHeight } from "./persistChatSplitHeight.js";
import { setChatSplitHeight } from "./setChatSplitHeight.js";

import type { ShadowClawDatabase } from "../../../db/types.js";

interface ChatSplitResizeHost {
  addCleanup: (fn: () => void) => void;
}

export async function initChatSplitResize(
  shadow: ShadowRoot | null,
  shadowClaw: ChatSplitResizeHost,
  handle: HTMLElement,
  db: ShadowClawDatabase | undefined,
): Promise<void> {
  if (!shadow || !handle) {
    return;
  }

  handle.setAttribute("tabindex", "0");
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "horizontal");
  handle.setAttribute("aria-label", "Resize chat panel height");

  const getCurrentHeight = () => {
    const mainContent = shadow.querySelector(".main-content");
    if (!(mainContent instanceof HTMLElement)) {
      return DEFAULT_CHAT_SPLIT_HEIGHT_PX;
    }

    const stored = parseFloat(
      mainContent.style.getPropertyValue("--chat-split-height"),
    );
    if (Number.isFinite(stored) && stored > 0) {
      return stored;
    }

    const chatPage = shadow.querySelector(".chat-page");
    return (
      (chatPage instanceof HTMLElement &&
        chatPage.getBoundingClientRect().height) ||
      DEFAULT_CHAT_SPLIT_HEIGHT_PX
    );
  };

  const updateAria = () => {
    const current = Math.round(
      clampChatSplitHeight(shadow, getCurrentHeight()),
    );
    const max = Math.round(
      clampChatSplitHeight(shadow, Number.MAX_SAFE_INTEGER),
    );
    handle.setAttribute("aria-valuemin", String(MIN_CHAT_SPLIT_HEIGHT_PX));
    handle.setAttribute("aria-valuemax", String(max));
    handle.setAttribute("aria-valuenow", String(current));
  };

  try {
    const saved = db
      ? await getConfig(db, CONFIG_KEYS.CHAT_SPLIT_VIEW_HEIGHT)
      : undefined;

    if (typeof saved === "number" && Number.isFinite(saved) && saved > 0) {
      setChatSplitHeight(shadow, saved);
    } else if (typeof saved === "string" && !isNaN(parseFloat(saved))) {
      setChatSplitHeight(shadow, parseFloat(saved));
    } else {
      setChatSplitHeight(shadow, DEFAULT_CHAT_SPLIT_HEIGHT_PX);
    }
  } catch {
    setChatSplitHeight(shadow, DEFAULT_CHAT_SPLIT_HEIGHT_PX);
  }

  let activePointerId: number | null = null;
  let startY = 0;
  let startHeight = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Dragging handle UP (delta > 0) increases height of bottom chat panel
    const delta = startY - event.clientY;
    const nextHeight = startHeight + delta;
    setChatSplitHeight(shadow, nextHeight);
    updateAria();
  };

  const stopResize = () => {
    if (activePointerId === null) {
      return;
    }

    activePointerId = null;
    handle.classList.remove("active");
    document.removeEventListener("pointermove", onPointerMove);

    const mainContent = shadow.querySelector(".main-content");
    if (mainContent instanceof HTMLElement) {
      const value = parseFloat(
        mainContent.style.getPropertyValue("--chat-split-height"),
      );
      if (Number.isFinite(value) && value > 0 && db) {
        void persistChatSplitHeight(db, value);
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
    startY = event.clientY;
    const chatPage = shadow.querySelector(".chat-page");
    startHeight =
      chatPage instanceof HTMLElement &&
      chatPage.getBoundingClientRect().height > 0
        ? chatPage.getBoundingClientRect().height
        : getCurrentHeight();
    handle.classList.add("active");

    handle.setPointerCapture(event.pointerId);
    document.addEventListener("pointermove", onPointerMove);
  });

  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("dblclick", () => {
    setChatSplitHeight(shadow, DEFAULT_CHAT_SPLIT_HEIGHT_PX);
    if (db) {
      void persistChatSplitHeight(db, DEFAULT_CHAT_SPLIT_HEIGHT_PX);
    }

    updateAria();
  });

  handle.addEventListener("keydown", (event: KeyboardEvent) => {
    if (window.innerWidth < 896) {
      return;
    }

    const step = event.shiftKey ? 32 : 12;
    const current = getCurrentHeight();
    let next: number | null = null;

    if (event.key === "ArrowUp") {
      next = current + step;
    } else if (event.key === "ArrowDown") {
      next = current - step;
    } else if (event.key === "Home") {
      next = MIN_CHAT_SPLIT_HEIGHT_PX;
    } else if (event.key === "End") {
      next = clampChatSplitHeight(shadow, Number.MAX_SAFE_INTEGER);
    }

    if (next === null) {
      return;
    }

    event.preventDefault();
    setChatSplitHeight(shadow, next);
    updateAria();
    if (db) {
      void persistChatSplitHeight(
        db,
        clampChatSplitHeight(shadow, getCurrentHeight()),
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
