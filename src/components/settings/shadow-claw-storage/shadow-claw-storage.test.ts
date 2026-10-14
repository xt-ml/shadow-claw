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

jest.unstable_mockModule("../../../storage/selectStorageDirectory.js", () => ({
  selectStorageDirectory: jest.fn<any>().mockResolvedValue(true),
}));

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
    grantStorageAccess: jest.fn<any>().mockResolvedValue(undefined),
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

  it("handles handleChangeStorageDir success and errors", async () => {
    const { selectStorageDirectory } =
      await import("../../../storage/selectStorageDirectory.js");
    const { showError } = await import("../../../ui/toast.js");

    const el = new ShadowClawStorage() as any;
    el.db = {};
    el.updateStorageInfo = jest.fn();

    (selectStorageDirectory as jest.Mock<any>).mockResolvedValueOnce(true);
    await el.handleChangeStorageDir();
    expect(showSuccess).toHaveBeenCalledWith(
      "Storage location changed. Existing OPFS files were not moved.",
      4500,
    );

    (selectStorageDirectory as jest.Mock<any>).mockRejectedValueOnce(
      new Error("Directory pick error"),
    );
    await el.handleChangeStorageDir();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Directory pick error"),
      6000,
    );
  });

  it("handles errors during storage operations", async () => {
    const { showError } = await import("../../../ui/toast.js");
    const { requestPersistentStorage } =
      await import("../../../storage/requestPersistentStorage.js");
    const { resetStorageDirectory } =
      await import("../../../storage/storage.js");
    const { orchestratorStore } =
      await import("../../../stores/orchestrator.js");

    const el = new ShadowClawStorage() as any;
    el.db = {};
    el.updateStorageInfo = jest.fn();
    el.requestConfirmation = jest.fn().mockResolvedValue(true);

    // 1. handleRequestPersistent error
    (requestPersistentStorage as jest.Mock<any>).mockRejectedValueOnce(
      new Error("Persistent error"),
    );
    await el.handleRequestPersistent();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Persistent error"),
      6000,
    );

    // 2. handleResetSiteConfig error
    (
      orchestratorStore.resetSiteConfigSeed as jest.Mock<any>
    ).mockRejectedValueOnce(new Error("Site config error"));
    await el.handleResetSiteConfig();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Site config error"),
      6000,
    );

    // 3. handleResetStorageDir error
    (resetStorageDirectory as jest.Mock<any>).mockRejectedValueOnce(
      new Error("Reset storage error"),
    );
    await el.handleResetStorageDir();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Reset storage error"),
      6000,
    );

    // 4. onUploadAppendUlidToggle error
    (setConfig as jest.Mock<any>).mockRejectedValueOnce(
      new Error("ULID toggle error"),
    );
    await el.onUploadAppendUlidToggle(true);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("ULID toggle error"),
      6000,
    );
  });

  it("handles requestConfirmation via appShell and fallback warning", async () => {
    const { showWarning } = await import("../../../ui/toast.js");
    const el = new ShadowClawStorage();

    // 1. Fallback when shadow-claw element does not exist
    const res1 = await el.requestConfirmation({
      title: "Test",
      message: "Confirm action?",
    });
    expect(res1).toBe(false);
    expect(showWarning).toHaveBeenCalledWith("Confirm action?", 4500);

    // 2. With appShell requestDialog
    const appShell = document.createElement("shadow-claw") as any;
    appShell.requestDialog = jest.fn().mockResolvedValue(true);
    document.body.appendChild(appShell);

    const res2 = await el.requestConfirmation({
      title: "Test",
      message: "Confirm action?",
    });
    expect(res2).toBe(true);
    expect(appShell.requestDialog).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "confirm", title: "Test" }),
    );

    document.body.removeChild(appShell);
  });

  it("handles button clicks in template and early returns when db is null", async () => {
    const el = new ShadowClawStorage();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    el.db = {} as any;

    const root = el.shadowRoot!;
    const reqBtn = root.querySelector('[data-action="request-persistent"]');
    const changeBtn = root.querySelector('[data-action="change-storage-dir"]');
    const resetStorageBtn = root.querySelector(
      '[data-action="reset-storage-dir"]',
    );
    const resetConfigBtn = root.querySelector(
      '[data-action="reset-site-config"]',
    );
    const grantBtn = root.querySelector(
      '[data-action="grant-storage-permission"]',
    );

    const handleReqSpy = jest
      .spyOn(el, "handleRequestPersistent")
      .mockImplementation(async () => {});
    const handleChangeSpy = jest
      .spyOn(el, "handleChangeStorageDir")
      .mockImplementation(async () => {});
    const handleResetStorageSpy = jest
      .spyOn(el, "handleResetStorageDir")
      .mockImplementation(async () => {});
    const handleResetConfigSpy = jest
      .spyOn(el, "handleResetSiteConfig")
      .mockImplementation(async () => {});

    reqBtn?.dispatchEvent(new Event("click"));
    expect(handleReqSpy).toHaveBeenCalled();

    changeBtn?.dispatchEvent(new Event("click"));
    expect(handleChangeSpy).toHaveBeenCalled();

    resetStorageBtn?.dispatchEvent(new Event("click"));
    expect(handleResetStorageSpy).toHaveBeenCalled();

    resetConfigBtn?.dispatchEvent(new Event("click"));
    expect(handleResetConfigSpy).toHaveBeenCalled();

    grantBtn?.dispatchEvent(new Event("click"));

    // Early returns when db is null
    el.db = null;
    await el.handleChangeStorageDir();
    await el.handleRequestPersistent();
    await el.handleResetSiteConfig();
    await el.handleResetStorageDir();
    await el.onUploadAppendUlidToggle(true);
    await el.updateStorageInfo();

    document.body.removeChild(el);
  });
});
