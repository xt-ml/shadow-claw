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

import { orchestratorStore } from "./stores/orchestrator.js";
import { resumeAudioContext } from "./audio.js";

import "./components/shadow-claw/shadow-claw.js";

import type { Orchestrator } from "./orchestrator.js";
import type { ShadowClaw } from "./components/shadow-claw/shadow-claw.js";

import { installE2eBridge, shouldInstallE2eBridge } from "./e2e-bridge.js";

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

    // Conditionally install E2E bridge for tests
    if (shouldInstallE2eBridge()) {
      console.log("🧪 E2E Test Bridge enabled");
      installE2eBridge(orchestratorStore, uiElement);
    }

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
