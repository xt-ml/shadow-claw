import {
  clearAllToasts,
  dismissToast,
  showError,
  showInfo,
  showSuccess,
  showToast,
  showWarning,
} from "./toast.js";

import { orchestratorStore } from "./stores/orchestrator.js";
import { resumeAudioContext } from "./audio.js";

import "./components/shadow-claw/shadow-claw.js";

import type { Orchestrator } from "./orchestrator.js";
import type { ShadowClaw } from "./components/shadow-claw/shadow-claw.js";
import type { ShadowClawGlobal } from "./types.js";

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
      get orchestrator() {
        return uiElement.orchestrator;
      },
      ui: uiElement,
      requestDialog: async (options) => {
        await customElements.whenDefined("shadow-claw");

        return uiElement.requestDialog(options);
      },
      requestConfirmation: async (options) => {
        await customElements.whenDefined("shadow-claw");

        return uiElement.requestConfirmation(options);
      },
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
