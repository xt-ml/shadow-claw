import { jest } from "@jest/globals";

const mockSetProvider = jest.fn(async () => {});
const mockSetModel = jest.fn(async () => {});
const mockSetStreamingEnabled = jest.fn(async () => {});

jest.unstable_mockModule(
  "../orchestrator/utils/operations/provider.js",
  () => ({
    setProvider: mockSetProvider,
    setModel: mockSetModel,
    getApiKeyForHeaders: jest.fn(async () => "mocked-api-key"),
    stopTransformersProgressPolling: jest.fn(),
  }),
);

jest.unstable_mockModule("../orchestrator/utils/settings.js", () => ({
  setStreamingEnabled: mockSetStreamingEnabled,
}));
describe("E2E Bridge", () => {
  let shouldInstallE2eBridge: any;
  let installE2eBridge: any;

  beforeAll(async () => {
    const bridge = await import("./e2e-bridge.js");
    shouldInstallE2eBridge = bridge.shouldInstallE2eBridge;
    installE2eBridge = bridge.installE2eBridge;
  });

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
          setApiKey: jest.fn(async () => {}),
          loadApiKeyForProvider: jest.fn(async () => {}),
          getApiKeyForHeaders: jest.fn(async () => {}),
        },
        createConversation: jest.fn(async () => ({
          groupId: "grp-new",
          name: "New Chat",
          title: "New Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })),
        switchConversation: jest.fn(async () => {}),
        loadTasks: jest.fn(async () => {}),
      };
    }

    function createMockUiElement() {
      return {
        db: {
          saveGroupMeta: jest.fn(async () => {}),
          loadGroupMeta: jest.fn(async () => ({})),
        },
      };
    }

    it("installs __SHADOWCLAW_E2E__ on globalThis", () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);

      expect((globalThis as any).__SHADOWCLAW_E2E__).toBeDefined();
    });

    it("bridge.isReady returns store.ready", () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      expect(bridge.isReady()).toBe(true);
      store.ready = false;
      expect(bridge.isReady()).toBe(false);
    });

    it("bridge.getDb returns uiElement.db", () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      expect(bridge.getDb()).toBe(ui.db);
    });

    it("bridge.getActiveGroupId returns store.activeGroupId", () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      expect(bridge.getActiveGroupId()).toBe("br:main");
    });

    it("bridge.getDbName and bridge.getOpfsRootName return string identifiers", () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      expect(typeof bridge.getDbName()).toBe("string");
      expect(typeof bridge.getOpfsRootName()).toBe("string");
    });

    it("bridge.createConversation delegates to store.createConversation", async () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      const meta = await bridge.createConversation("Test Topic");
      expect(store.createConversation).toHaveBeenCalledWith(
        ui.db,
        "Test Topic",
      );
      expect(meta.name).toBe("New Chat");
    });

    it("bridge.createConversation throws if DB not ready", async () => {
      const store = createMockStore();
      const ui = { db: null };

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      await expect(bridge.createConversation("Test")).rejects.toThrow(
        "DB not ready",
      );
    });

    it("bridge.switchConversation delegates to store.switchConversation", async () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      await bridge.switchConversation("grp-target");
      expect(store.switchConversation).toHaveBeenCalledWith(
        ui.db,
        "grp-target",
      );
    });

    it("bridge.switchConversation throws if DB not ready", async () => {
      const store = createMockStore();
      const ui = { db: null };

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      await expect(bridge.switchConversation("grp-1")).rejects.toThrow(
        "DB not ready",
      );
    });

    it("bridge.loadTasks delegates to store.loadTasks", async () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      await bridge.loadTasks();
      expect(store.loadTasks).toHaveBeenCalledWith(ui.db);
    });

    it("bridge.loadTasks throws if DB not ready", async () => {
      const store = createMockStore();
      const ui = { db: null };

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      await expect(bridge.loadTasks()).rejects.toThrow("DB not ready");
    });

    it("bridge.configureProvider sets provider, apiKey, model, and streaming", async () => {
      const store = createMockStore();
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      await bridge.configureProvider(
        "mock-provider",
        "mock-key",
        "mock-model-v1",
        true,
      );

      expect(mockSetProvider).toHaveBeenCalledWith(
        store.orchestrator,
        ui.db,
        "mock-provider",
        expect.any(Object),
      );
      expect(store.orchestrator.setApiKey).toHaveBeenCalledWith(
        ui.db,
        "mock-key",
      );
      expect(mockSetModel).toHaveBeenCalledWith(
        store.orchestrator,
        ui.db,
        "mock-model-v1",
      );
      expect(mockSetStreamingEnabled).toHaveBeenCalledWith(
        store.orchestrator,
        ui.db,
        true,
      );
    });

    it("bridge.configureProvider throws if orchestrator or DB not ready", async () => {
      const store = {
        ready: true,
        activeGroupId: "br:main",
        orchestrator: null,
      };
      const ui = createMockUiElement();

      installE2eBridge(store as any, ui as any);
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;

      await expect(
        bridge.configureProvider("mock-provider", "key", "model", false),
      ).rejects.toThrow("Orchestrator or DB not ready");
    });
  });
});
