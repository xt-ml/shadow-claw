import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.unstable_mockModule("../../notifications/push-client.js", () => ({
  getCurrentSubscription: jest.fn<any>().mockResolvedValue(null),
  subscribeToPush: jest
    .fn<any>()
    .mockResolvedValue({ endpoint: "test-endpoint" }),
  unsubscribeFromPush: jest.fn<any>().mockResolvedValue(true),
  getPushUrl: jest
    .fn<any>()
    .mockImplementation((path) => Promise.resolve(path)),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => ({
        get: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        put: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      })),
    })),
  }),
}));

// Global fetch is already mocked in jest-setup.ts

const { ShadowClawSettingsNotifications } =
  await import("./shadow-claw-settings-notifications.js");
const { showSuccess, showError } = await import("../../toast.js");
const pushClient = await import("../../notifications/push-client.js");

describe("shadow-claw-settings-notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-settings-notifications")).toBe(
      ShadowClawSettingsNotifications,
    );
  });

  it("renders state correctly when unsubscribed", async () => {
    const el = new ShadowClawSettingsNotifications();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((r) => setTimeout(r, 50));
    await el.refreshState();

    const status = el.shadowRoot?.querySelector(
      '[data-info="subscription-status"]',
    );
    expect(status?.textContent).toContain("Disabled");

    document.body.removeChild(el);
  });

  it("renders state correctly when subscribed", async () => {
    (
      (pushClient as any).getCurrentSubscription as jest.Mock<any>
    ).mockResolvedValue({
      endpoint: "test",
    });

    const el = new ShadowClawSettingsNotifications();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((r) => setTimeout(r, 50));
    await el.refreshState();

    const status = el.shadowRoot?.querySelector(
      '[data-info="subscription-status"]',
    );
    expect(status?.textContent).toContain("Enabled");

    document.body.removeChild(el);
  });
});
