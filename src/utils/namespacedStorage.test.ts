import {
  getNamespacedItem,
  getNamespacedStorageKey,
  removeNamespacedItem,
  setNamespacedItem,
} from "./namespacedStorage.js";

describe("namespacedStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).__SHADOWCLAW_DEPLOY_ID__;
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as any).__SHADOWCLAW_DEPLOY_ID__;
  });

  describe("getNamespacedStorageKey", () => {
    it("returns raw key when no deployment namespace is present", () => {
      expect(getNamespacedStorageKey("assistantName")).toBe("assistantName");
    });

    it("returns namespaced key when deployment namespace is present", () => {
      (window as any).__SHADOWCLAW_DEPLOY_ID__ = "deploy-1";
      expect(getNamespacedStorageKey("assistantName")).toBe(
        "shadowclaw:deploy-1:assistantName",
      );
    });
  });

  describe("getNamespacedItem / setNamespacedItem / removeNamespacedItem", () => {
    it("writes and reads namespaced item directly", () => {
      (window as any).__SHADOWCLAW_DEPLOY_ID__ = "deploy-1";
      setNamespacedItem("assistantName", "BotOne");

      expect(localStorage.getItem("shadowclaw:deploy-1:assistantName")).toBe(
        "BotOne",
      );
      expect(getNamespacedItem("assistantName")).toBe("BotOne");
    });

    it("falls back to legacy unprefixed item and copies it forward to namespaced storage", () => {
      // Legacy item present under unnamespaced key
      localStorage.setItem("assistantName", "OldBot");

      // Switch to deploy-2 namespace
      (window as any).__SHADOWCLAW_DEPLOY_ID__ = "deploy-2";

      // Reading under namespaced key should fallback to legacy value and seed namespaced key
      expect(getNamespacedItem("assistantName")).toBe("OldBot");

      // Verify legacy key was copied into namespaced storage
      expect(localStorage.getItem("shadowclaw:deploy-2:assistantName")).toBe(
        "OldBot",
      );
      // Verify legacy key was left untouched
      expect(localStorage.getItem("assistantName")).toBe("OldBot");
    });

    it("removes namespaced item correctly", () => {
      (window as any).__SHADOWCLAW_DEPLOY_ID__ = "deploy-1";
      setNamespacedItem("theme", "dark");
      expect(getNamespacedItem("theme")).toBe("dark");

      removeNamespacedItem("theme");
      expect(getNamespacedItem("theme")).toBeNull();
    });
  });
});
