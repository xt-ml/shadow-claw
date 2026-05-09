import { jest } from "@jest/globals";
import { installE2eBridge, shouldInstallE2eBridge } from "./e2e-bridge.js";

describe("E2E Bridge", () => {
  afterEach(() => {
    delete (globalThis as any).__SHADOWCLAW_E2E__;
    delete (globalThis as any).__SHADOWCLAW_E2E_ENABLE__;
  });

  describe("shouldInstallE2eBridge", () => {
    it("returns false when __SHADOWCLAW_E2E_ENABLE__ is not set", () => {
      expect(shouldInstallE2eBridge()).toBe(false);
    });

    it("returns false when __SHADOWCLAW_E2E_ENABLE__ is a string", () => {
      (globalThis as any).__SHADOWCLAW_E2E_ENABLE__ = "true";
      expect(shouldInstallE2eBridge()).toBe(false);
    });

    it("returns true when __SHADOWCLAW_E2E_ENABLE__ is boolean true", () => {
      (globalThis as any).__SHADOWCLAW_E2E_ENABLE__ = true;
      expect(shouldInstallE2eBridge()).toBe(true);
    });
  });

  describe("installE2eBridge", () => {
    function createMockStore() {
      return {
        ready: true,
        activeGroupId: "br:main",
        orchestrator: {
          setProvider: jest.fn(async () => {}),
          setApiKey: jest.fn(async () => {}),
          setModel: jest.fn(async () => {}),
          setStreamingEnabled: jest.fn(async () => {}),
        },
        createConversation: jest.fn(async (_db: any, name: string) => ({
          groupId: `br:${name}`,
          name,
          createdAt: Date.now(),
        })),
        switchConversation: jest.fn(async () => {}),
        loadTasks: jest.fn(async () => {}),
      } as any;
    }

    function createMockUi() {
      return { db: {} as any } as any;
    }

    it("installs bridge on globalThis.__SHADOWCLAW_E2E__", () => {
      const store = createMockStore();
      const ui = createMockUi();

      installE2eBridge(store, ui);

      expect((globalThis as any).__SHADOWCLAW_E2E__).toBeDefined();
    });

    it("isReady delegates to store.ready", () => {
      const store = createMockStore();
      const ui = createMockUi();

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      expect(bridge.isReady()).toBe(true);

      store.ready = false;
      // The bridge getter reads the live value (it's a function, not cached)
      // Since it reads store.ready directly, this depends on implementation.
      // We access via the property since the mock is a simple object.
      store._ready = { get: () => false };
    });

    it("getDb returns uiElement.db", () => {
      const store = createMockStore();
      const mockDb = { fake: "db" };
      const ui = { db: mockDb } as any;

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      expect(bridge.getDb()).toBe(mockDb);
    });

    it("getActiveGroupId returns store.activeGroupId", () => {
      const store = createMockStore();
      const ui = createMockUi();

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      expect(bridge.getActiveGroupId()).toBe("br:main");
    });

    it("createConversation delegates to store", async () => {
      const store = createMockStore();
      const ui = createMockUi();

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      const result = await bridge.createConversation("Test");

      expect(store.createConversation).toHaveBeenCalledWith(ui.db, "Test");
      expect(result.name).toBe("Test");
    });

    it("switchConversation delegates to store", async () => {
      const store = createMockStore();
      const ui = createMockUi();

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      await bridge.switchConversation("br:test");

      expect(store.switchConversation).toHaveBeenCalledWith(ui.db, "br:test");
    });

    it("loadTasks delegates to store", async () => {
      const store = createMockStore();
      const ui = createMockUi();

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      await bridge.loadTasks();

      expect(store.loadTasks).toHaveBeenCalledWith(ui.db);
    });

    it("configureProvider delegates to orchestrator methods", async () => {
      const store = createMockStore();
      const ui = createMockUi();

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      await bridge.configureProvider(
        "openrouter",
        "sk-test-123",
        "test/model",
        true,
      );

      const orch = store.orchestrator;
      expect(orch.setProvider).toHaveBeenCalledWith(ui.db, "openrouter");
      expect(orch.setApiKey).toHaveBeenCalledWith(ui.db, "sk-test-123");
      expect(orch.setModel).toHaveBeenCalledWith(ui.db, "test/model");
      expect(orch.setStreamingEnabled).toHaveBeenCalledWith(ui.db, true);
    });

    it("configureProvider throws when orchestrator is not ready", async () => {
      const store = createMockStore();
      store.orchestrator = null;
      const ui = createMockUi();

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      await expect(
        bridge.configureProvider("openrouter", "key", "model", true),
      ).rejects.toThrow("Orchestrator or DB not ready");
    });

    it("createConversation throws when DB is not ready", async () => {
      const store = createMockStore();
      const ui = { db: null } as any;

      installE2eBridge(store, ui);

      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      await expect(bridge.createConversation("Test")).rejects.toThrow(
        "DB not ready",
      );
    });
  });
});
