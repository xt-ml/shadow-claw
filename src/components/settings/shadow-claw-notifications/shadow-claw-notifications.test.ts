import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../notifications/push-client.js", () => ({
  getCurrentSubscription: jest.fn<any>().mockResolvedValue(null),
  subscribeToPush: jest
    .fn<any>()
    .mockResolvedValue({ endpoint: "test-endpoint" }),
  unsubscribeFromPush: jest.fn<any>().mockResolvedValue(true),
  getPushUrl: jest
    .fn<any>()
    .mockImplementation((path) => Promise.resolve(path)),
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
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

const { ShadowClawNotifications } =
  await import("./shadow-claw-notifications.js");
const pushClient = await import("../../../notifications/push-client.js");

describe("shadow-claw-notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-notifications")).toBe(
      ShadowClawNotifications,
    );
  });

  it("renders state correctly when unsubscribed", async () => {
    const el = new ShadowClawNotifications();
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

    const el = new ShadowClawNotifications();
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
