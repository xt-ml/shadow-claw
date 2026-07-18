import { orchestratorStore } from "../../stores/orchestrator.js";
import {
  installE2eBridge,
  shouldInstallE2eBridge,
} from "../../testing/e2e-bridge.js";
import { clearBootPendingClass } from "./clearBootPendingClass.js";

import { type ShadowClaw } from "../../components/shadow-claw/shadow-claw.js";
import { type Orchestrator } from "../orchestrator/orchestrator.js";

export async function initializeApp(
  doc: Document,
  isInitializing: boolean,
): Promise<
  { orchestrator: Orchestrator; isInitializing: boolean } | undefined
> {
  if (isInitializing) {
    return;
  }

  isInitializing = true;
  try {
    console.log("🦞 ShadowClaw initializing...");

    const uiElement = (doc.querySelector("shadow-claw") ||
      doc.body.appendChild(doc.createElement("shadow-claw"))) as ShadowClaw;

    console.log("✅ ShadowClaw initialized successfully");
    isInitializing = false;

    // Conditionally install E2E bridge for tests
    if (shouldInstallE2eBridge()) {
      console.log("🧪 E2E Test Bridge enabled");
      installE2eBridge(orchestratorStore, uiElement);
    }

    await orchestratorStore.whenInitialized;

    return { orchestrator: uiElement.orchestrator, isInitializing };
  } catch (error) {
    console.error("❌ Failed to initialize ShadowClaw:", error);

    throw error;
  } finally {
    clearBootPendingClass(doc);
  }
}
