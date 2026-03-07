import { resumeAudioContext } from "./src/audio.mjs";

import ShadowClaw from "./src/components/shadow-claw.mjs";

import { Orchestrator } from "./src/orchestrator.mjs";

import "./src/types.mjs";

/**
 * @typedef {Object} ShadowClawGlobal
 *
 * @property {Orchestrator} orchestrator
 * @property {ShadowClaw} ui
 */

/**
 * Extension of globalThis with shadowclaw property.
 *
 * @typedef {typeof globalThis & { shadowclaw: ShadowClawGlobal }} ShadowClawGlobalThis
 */

/**
 * Initialize the application
 *
 * @returns {Promise<Orchestrator|undefined>}
 */
async function initializeApp() {
  try {
    console.log("🦞 ShadowClaw initializing...");

    // Create and initialize orchestrator
    const orchestrator = new Orchestrator();
    const db = await orchestrator.init();

    // Get or create the UI element
    let uiElement = document.querySelector("shadow-claw");
    if (!uiElement) {
      uiElement = document.createElement("shadow-claw");
      document.body.appendChild(uiElement);
    }

    // Initialize the UI with the orchestrator
    if (uiElement) {
      /** @type {ShadowClaw} */
      const ui = /** @type {any} */ (uiElement);
      await ui.initialize(db, orchestrator);
    }

    console.log("✅ ShadowClaw initialized successfully");

    // Store orchestrator and UI globally for debugging
    /** @type {ShadowClawGlobalThis} */
    (globalThis).shadowclaw = {
      orchestrator,
      ui: /** @type {ShadowClaw} */ (uiElement),
    };

    return orchestrator;
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

export { initializeApp };
