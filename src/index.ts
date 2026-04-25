import { resumeAudioContext } from "./audio.js";
import {
  clearAllToasts,
  dismissToast,
  showError,
  showInfo,
  showSuccess,
  showToast,
  showWarning,
} from "./toast.js";

import ShadowClaw from "./components/shadow-claw/shadow-claw.js";
console.log("[index] ShadowClaw module imported:", typeof ShadowClaw);

import { Orchestrator } from "./orchestrator.js";
import { orchestratorStore } from "./stores/orchestrator.js";

import "./types.js";
import { ShadowClawGlobal } from "./types.js";

let isInitializing = false;
async function initializeApp(): Promise<Orchestrator | undefined> {
  if (isInitializing) {
    return;
  }

  isInitializing = true;
  try {
    console.log("🦞 ShadowClaw initializing...");

    const uiElement = (document.querySelector("shadow-claw") ||
      document.body.appendChild(
        document.createElement("shadow-claw"),
      )) as ShadowClaw;

    console.log("✅ ShadowClaw initialized successfully");

    // Store orchestrator and UI globally for debugging
    const shadowclaw: ShadowClawGlobal = {
      orchestrator: uiElement.orchestrator,
      ui: uiElement,
      requestConfirmation: (options) => uiElement.requestConfirmation(options),
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      dismissToast,
      clearAllToasts,
    };

    globalThis.shadowclaw = shadowclaw;

    // Expose orchestratorStore and db for e2e tests
    globalThis.orchestratorStore = orchestratorStore;
    Object.defineProperty(globalThis, "__SHADOWCLAW_DB__", {
      get: () => uiElement.db,
      configurable: true,
    });
    Object.defineProperty(globalThis, "SHADOWCLAW_DB", {
      get: () => uiElement.db,
      configurable: true,
    });

    return uiElement.orchestrator;
  } catch (error) {
    console.error("❌ Failed to initialize ShadowClaw:", error);

    throw error;
  }
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp().catch((err) => {
    console.error("Fatal error during initialization:", err);
  });
}

// Register user gesture listeners for audio resumption
if (typeof window !== "undefined") {
  ["click", "keydown", "touchstart"].forEach((event) => {
    window.addEventListener(event, resumeAudioContext, { once: true });
  });
}
