/**
 * E2E Test Bridge — narrow API surface for Playwright e2e tests.
 *
 * This bridge is only installed when `window.__SHADOWCLAW_E2E_ENABLE__`
 * is set to `true` BEFORE the app initializes (e.g. via
 * `page.addInitScript` in Playwright). Production users never set this
 * flag so the bridge stays dormant.
 *
 * The bridge deliberately does NOT expose:
 * - The Orchestrator instance (would leak apiKey)
 * - Raw store internals (would bypass encapsulation)
 * - The DB handle on the global scope (would enable arbitrary IDB writes)
 */

import type { ShadowClaw } from "./components/shadow-claw/shadow-claw.js";
import type { OrchestratorStore } from "./stores/orchestrator.js";
import type { GroupMeta, ShadowClawDatabase } from "./types.js";

export interface E2eBridge {
  /** Returns true when the orchestrator store is fully initialized. */
  isReady(): boolean;

  /** Get the IDB handle (for low-level e2e fixture setup). */
  getDb(): ShadowClawDatabase;

  /** Get the currently active group (conversation) ID. */
  getActiveGroupId(): string;

  /** Create a new conversation and return its metadata. */
  createConversation(name: string): Promise<GroupMeta>;

  /** Switch the active conversation. */
  switchConversation(groupId: string): Promise<void>;

  /** Load tasks for the active conversation. */
  loadTasks(): Promise<void>;

  /**
   * Configure a provider + API key + model + streaming in one call.
   * This replaces the old pattern of reaching into orchestrator internals.
   */
  configureProvider(
    providerId: string,
    apiKey: string,
    model: string,
    streamingEnabled: boolean,
  ): Promise<void>;
}

/**
 * Install the e2e bridge on `globalThis.__SHADOWCLAW_E2E__`.
 *
 * Only call this if the e2e gate flag is set.
 */
export function installE2eBridge(
  store: OrchestratorStore,
  uiElement: ShadowClaw,
): void {
  const bridge: E2eBridge = {
    isReady(): boolean {
      return store.ready;
    },

    getDb(): ShadowClawDatabase {
      return uiElement.db;
    },

    getActiveGroupId(): string {
      return store.activeGroupId;
    },

    async createConversation(name: string): Promise<GroupMeta> {
      const db = uiElement.db;
      if (!db) {
        throw new Error("[E2E Bridge] DB not ready");
      }

      return store.createConversation(db, name);
    },

    async switchConversation(groupId: string): Promise<void> {
      const db = uiElement.db;
      if (!db) {
        throw new Error("[E2E Bridge] DB not ready");
      }

      await store.switchConversation(db, groupId);
    },

    async loadTasks(): Promise<void> {
      const db = uiElement.db;
      if (!db) {
        throw new Error("[E2E Bridge] DB not ready");
      }

      await store.loadTasks(db);
    },

    async configureProvider(
      providerId: string,
      apiKey: string,
      model: string,
      streamingEnabled: boolean,
    ): Promise<void> {
      const orchestrator = store.orchestrator;
      const db = uiElement.db;

      if (!orchestrator || !db) {
        throw new Error("[E2E Bridge] Orchestrator or DB not ready");
      }

      await orchestrator.setProvider(db, providerId);
      await orchestrator.setApiKey(db, apiKey);
      await orchestrator.setModel(db, model);
      await orchestrator.setStreamingEnabled(db, streamingEnabled);
    },
  };

  (globalThis as any).__SHADOWCLAW_E2E__ = bridge;
}

/**
 * Returns true if the e2e bridge should be installed.
 *
 * Activation requires `window.__SHADOWCLAW_E2E_ENABLE__` to be set to
 * `true` before the app script runs. Playwright tests do this via
 * `page.addInitScript(() => { window.__SHADOWCLAW_E2E_ENABLE__ = true; })`.
 */
export function shouldInstallE2eBridge(): boolean {
  return (globalThis as any).__SHADOWCLAW_E2E_ENABLE__ === true;
}
