import { jest } from "@jest/globals";

// Mock CSSStyleSheet for JSDOM
(globalThis as any).CSSStyleSheet = class {
  replaceSync() {}
} as any;

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showToast: jest.fn(),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../storage/isPersistent.js", () => ({
  isPersistent: jest.fn<any>().mockResolvedValue(false),
}));

jest.unstable_mockModule(
  "../../../storage/requestPersistentStorage.js",
  () => ({
    requestPersistentStorage: jest.fn<any>().mockResolvedValue(true),
  }),
);

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => ({
        get: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      })),
    })),
  }),
}));

jest.unstable_mockModule("../../../storage/getStorageEstimate.js", () => ({
  getStorageEstimate: jest
    .fn<any>()
    .mockResolvedValue({ usage: 1024, quota: 10240 }),
}));

jest.unstable_mockModule("../../../storage/storage.js", () => ({
  resetStorageDirectory: jest.fn<any>().mockResolvedValue(undefined),
  getStorageRoot: jest.fn<any>().mockResolvedValue({}),
  setStorageRoot: jest.fn(),
  invalidateStorageRoot: jest.fn(),
  isStaleHandleError: jest.fn(() => false),
  setStorageDirectory: jest.fn<any>().mockResolvedValue(undefined),
  getStorageStatus: jest
    .fn<any>()
    .mockResolvedValue({ type: "opfs", permission: "granted", name: "OPFS" }),
  getOpfsRootDirName: jest.fn(() => "shadow-claw-opfs"),
  isDirectoryHandle: jest.fn(() => false),
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    storageStatus: { type: "opfs", permission: "granted" },
    resetSiteConfigSeed: jest.fn<any>().mockResolvedValue(undefined),
    loadFiles: jest.fn<any>().mockResolvedValue(undefined),
  },
}));

const { CONFIG_KEYS } = await import("../../../config/config.js");
const { getConfig } = await import("../../../db/getConfig.js");
const { setConfig } = await import("../../../db/setConfig.js");
const { showSuccess } = await import("../../../ui/toast.js");
const { ShadowClawStorage } = await import("./shadow-claw-storage.js");

describe("shadow-claw-storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-storage")).toBe(ShadowClawStorage);
  });

  it("renders storage usage", async () => {
    const el = new ShadowClawStorage();
    document.body.appendChild(el);

    // Give it plenty of time
    await new Promise((r) => setTimeout(r, 500));
    await el.updateStorageInfo();

    const usage = el.shadowRoot?.querySelector('[data-info="storage-usage"]');
    expect(usage?.textContent).toContain("1 KB");

    document.body.removeChild(el);
  });

  it("renders and syncs upload append ULID toggle", async () => {
    (getConfig as any).mockImplementation((_db: any, key: string) => {
      if (key === CONFIG_KEYS.FILES_UPLOAD_APPEND_ULID) {
        return Promise.resolve("true");
      }
      return Promise.resolve(undefined);
    });

    const el = new ShadowClawStorage();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 100));
    await el.updateStorageInfo();

    const toggle = el.shadowRoot?.querySelector(
      '[data-setting="files-upload-append-ulid-toggle"]',
    ) as HTMLInputElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(true);

    toggle!.checked = false;
    toggle!.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 50));

    expect(setConfig).toHaveBeenCalledWith(
      expect.anything(),
      CONFIG_KEYS.FILES_UPLOAD_APPEND_ULID,
      "false",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Unique ID prefix on file upload disabled",
      2500,
    );

    document.body.removeChild(el);
  });

  it("formats bytes accurately", () => {
    const el = new ShadowClawStorage();
    expect(el.formatBytes(0)).toBe("0 B");
    expect(el.formatBytes(1024)).toBe("1 KB");
    expect(el.formatBytes(1048576)).toBe("1 MB");
    expect(el.formatBytes(1073741824)).toBe("1 GB");
  });

  it("handles requestPersistentStorage", async () => {
    const el = new ShadowClawStorage() as any;
    el.db = {};
    el.updateStorageInfo = jest.fn();

    const { requestPersistentStorage } =
      await import("../../../storage/requestPersistentStorage.js");
    (requestPersistentStorage as jest.Mock<any>).mockResolvedValueOnce(true);

    await el.handleRequestPersistent();
    expect(showSuccess).toHaveBeenCalledWith(
      "Persistent storage granted",
      3500,
    );

    const { showWarning } = await import("../../../ui/toast.js");
    (requestPersistentStorage as jest.Mock<any>).mockResolvedValueOnce(false);
    await el.handleRequestPersistent();
    expect(showWarning).toHaveBeenCalled();
  });

  it("handles handleResetSiteConfig and handleResetStorageDir", async () => {
    const el = new ShadowClawStorage() as any;
    el.db = {};
    el.updateStorageInfo = jest.fn();

    // With confirmation false
    el.requestConfirmation = (jest.fn() as any).mockResolvedValue(false);
    await el.handleResetSiteConfig();
    await el.handleResetStorageDir();

    // With confirmation true
    el.requestConfirmation = (jest.fn() as any).mockResolvedValue(true);
    await el.handleResetSiteConfig();
    expect(showSuccess).toHaveBeenCalledWith(
      "Site config reset. Reload to apply its defaults again.",
      5000,
    );

    await el.handleResetStorageDir();
    expect(showSuccess).toHaveBeenCalledWith(
      "Reverted to browser-internal storage",
      3500,
    );
  });
});
