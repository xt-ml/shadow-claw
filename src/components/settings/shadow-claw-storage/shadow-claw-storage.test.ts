import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

// Mock CSSStyleSheet for JSDOM
(globalThis as any).CSSStyleSheet = class {
  replaceSync() {}
} as any;

jest.unstable_mockModule("../../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
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

// Global fetch is already mocked in jest-setup.ts

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
});
