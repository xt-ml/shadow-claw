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
});
