// Lock critical globals early to prevent runtime monkey-patching and interception
if (typeof window !== "undefined") {
  // Skip locking in E2E tests to avoid interference with Playwright's network interception
  if (!(window as any).__SHADOWCLAW_E2E_ENABLE__) {
    try {
      Object.defineProperty(window, "fetch", {
        value: window.fetch,
        writable: false,
        configurable: false,
      });

      if (window.crypto && window.crypto.subtle) {
        Object.defineProperty(window.crypto, "subtle", {
          value: window.crypto.subtle,
          writable: false,
          configurable: false,
        });
      }
    } catch (e) {
      console.warn("[ShadowClaw] Security: Failed to lock globals:", e);
    }
  }
}

import { initializeApp } from "./utils/initializeApp.js";
import { resumeAudioContext } from "../ui/audio.js";

import "../components/shadow-claw/shadow-claw.js";

export const BOOT_PENDING_CLASS = "sc-js-boot-pending";
export const BOOT_PENDING_ATTR = "data-js-boot-pending";
export const HYDRATION_PENDING_ATTR = "data-hydration-pending";

let isInitializing = false;

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const result = await initializeApp(document, isInitializing);
      isInitializing = Boolean(result?.isInitializing);
    } catch (e) {
      console.error("Fatal error during initialization:", e);
      isInitializing = false;
    }
  });
} else {
  initializeApp(document, isInitializing)
    .then((result) => {
      isInitializing = Boolean(result?.isInitializing);
    })
    .catch((err) => {
      console.error("Fatal error during initialization:", err);
      isInitializing = false;
    });
}

// Register user gesture listeners for audio resumption
if (typeof window !== "undefined") {
  ["click", "keydown", "touchstart"].forEach((event) => {
    window.addEventListener(event, resumeAudioContext, { once: true });
  });
}
