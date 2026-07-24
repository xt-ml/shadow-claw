import { jest } from "@jest/globals";

jest.unstable_mockModule(
  "../../../subsystems/notifications/push-client.js",
  () => ({
    getCurrentSubscription: jest.fn<any>().mockResolvedValue(null),
    subscribeToPush: jest
      .fn<any>()
      .mockResolvedValue({ endpoint: "test-endpoint" }),
    unsubscribeFromPush: jest.fn<any>().mockResolvedValue(true),
    getPushUrl: jest
      .fn<any>()
      .mockImplementation((path: string) => Promise.resolve(path)),
  }),
);

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
}));

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
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
const pushClient =
  await import("../../../subsystems/notifications/push-client.js");

describe("shadow-claw-notifications", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-notifications")).toBe(
      ShadowClawNotifications,
    );
  });

  it("renders state correctly when unsubscribed", async () => {
    const el = new ShadowClawNotifications();
    document.body.appendChild(el);
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
    await new Promise((r) => setTimeout(r, 50));
    await el.refreshState();

    const status = el.shadowRoot?.querySelector(
      '[data-info="subscription-status"]',
    );
    expect(status?.textContent).toContain("Enabled");

    document.body.removeChild(el);
  });

  it("handles push toggle correctly (enable and disable)", async () => {
    const el = new ShadowClawNotifications();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    // Enable
    el._subscribed = false;
    const toggle = el.shadowRoot?.querySelector('[data-action="toggle-push"]');
    toggle?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));
    expect(pushClient.subscribeToPush).toHaveBeenCalled();
    expect(el._subscribed).toBe(true);

    // Disable
    toggle?.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(pushClient.unsubscribeFromPush).toHaveBeenCalled();
    expect(el._subscribed).toBe(false);

    document.body.removeChild(el);
  });

  it("renders subscription list correctly", async () => {
    const el = new ShadowClawNotifications();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    el._subscriptions = [
      { id: 1, endpoint: "https://example.com/1", created_at: "2026-01-01" },
      {
        id: 2,
        endpoint: "https://example.com/2".repeat(10),
        created_at: "2026-01-02",
      },
    ];
    el.renderSubscriptionList();

    const items = el.shadowRoot?.querySelectorAll(".subscription-item");
    expect(items?.length).toBe(2);

    // Test selection
    (items?.[0] as HTMLElement).click();
    expect(el._selectedId).toBe(1);

    document.body.removeChild(el);
  });

  it("handles loadSubscriptions success and error", async () => {
    const el = new ShadowClawNotifications();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    // Success
    global.fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, endpoint: "test" }]),
    });
    await el.loadSubscriptions();
    expect(el._subscriptions.length).toBe(1);
    expect(el._backendAvailable).toBe(true);

    // Error
    global.fetch = jest.fn<any>().mockRejectedValue(new Error("Network Error"));
    await el.loadSubscriptions();
    expect(el._subscriptions.length).toBe(0);
    expect(el._backendAvailable).toBe(false);

    document.body.removeChild(el);
  });

  it("handles delete subscription", async () => {
    const el = new ShadowClawNotifications();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    el._selectedId = 1;
    global.fetch = jest.fn<any>().mockResolvedValue({ ok: true });

    const deleteBtn = el.shadowRoot?.querySelector(
      '[data-action="delete-subscription"]',
    );
    deleteBtn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));
    expect(global.fetch).toHaveBeenCalledWith("/push/subscription/1", {
      method: "DELETE",
    });

    document.body.removeChild(el);
  });

  it("handles send notification", async () => {
    const el = new ShadowClawNotifications();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    el._subscriptions = [{ id: 1, endpoint: "test-end", created_at: "" }];
    el._selectedId = 1;
    global.fetch = jest.fn<any>().mockResolvedValue({ ok: true });

    const sendBtn = el.shadowRoot?.querySelector(
      '[data-action="send-notification"]',
    );
    sendBtn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));
    expect(global.fetch).toHaveBeenCalledWith(
      "/push/send",
      expect.objectContaining({ method: "POST" }),
    );

    document.body.removeChild(el);
  });

  it("handles proxy url change", async () => {
    const el = new ShadowClawNotifications();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    const input = el.shadowRoot?.querySelector(
      '[data-input="push-proxy-url"]',
    ) as HTMLInputElement;
    if (input) {
      input.value = "new-url";
      input.dispatchEvent(new Event("change"));
      await new Promise((r) => setTimeout(r, 50));
    }

    document.body.removeChild(el);
  });
});
