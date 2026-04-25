import { jest } from "@jest/globals";

// Mock service worker and Push API
const mockSubscription: any = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  toJSON() {
    return {
      endpoint: this.endpoint,
      keys: { p256dh: "test-key", auth: "test-auth" },
    };
  },

  unsubscribe: (jest.fn() as any).mockResolvedValue(true),
};

const mockPushManager: any = {
  subscribe: (jest.fn() as any).mockResolvedValue(mockSubscription),

  getSubscription: (jest.fn() as any).mockResolvedValue(null),
};

const mockRegistration: any = {
  pushManager: mockPushManager,
};

// Setup navigator.serviceWorker mock
Object.defineProperty((globalThis as any).navigator, "serviceWorker", {
  value: {
    ready: Promise.resolve(mockRegistration),
  },
  writable: true,
  configurable: true,
});

// Setup fetch mock

(globalThis as any).fetch = jest.fn();
(globalThis as any).navigator.serviceWorker = {
  ready: Promise.resolve(mockRegistration),
};

// Mock database functions using ESM-compatible unstable_mockModule
jest.unstable_mockModule("../db/db.js", () => ({
  getDb: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: jest.fn().mockResolvedValue(null),
}));

const {
  getVapidPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  urlBase64ToUint8Array,
} = await import("./push-client.js");

describe("push-client", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPushManager.getSubscription.mockResolvedValue(null);
  });

  describe("urlBase64ToUint8Array", () => {
    it("converts a URL-safe base64 string to Uint8Array", () => {
      // "AQAB" in standard base64 = [1, 0, 1]
      const result = urlBase64ToUint8Array("AQAB");
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(1);
    });

    it("handles URL-safe characters (- and _)", () => {
      // URL-safe base64 uses - instead of + and _ instead of /
      const result = urlBase64ToUint8Array("A-B_");
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe("getVapidPublicKey", () => {
    it("fetches the VAPID public key from server", async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ publicKey: "test-vapid-key" }),
      });

      const key = await getVapidPublicKey();
      expect(key).toBe("test-vapid-key");
      expect(fetch).toHaveBeenCalledWith("/push/vapid-public-key");
    });
  });

  describe("subscribeToPush", () => {
    it("subscribes to push and posts subscription to server", async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ publicKey: "test-vapid-key" }),
        })
        .mockResolvedValueOnce({ ok: true });

      const sub = await subscribeToPush();
      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });

      // Verify the subscription was sent to the server
      expect(fetch).toHaveBeenCalledTimes(2);

      const postCall = (fetch as any).mock.calls[1];
      expect(postCall[0]).toBe("/push/subscribe");
      expect(postCall[1].method).toBe("POST");
    });
  });

  describe("unsubscribeFromPush", () => {
    it("unsubscribes existing subscription and notifies server", async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);

      (fetch as any).mockResolvedValue({ ok: true });

      await unsubscribeFromPush();
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith("/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: mockSubscription.endpoint }),
      });
    });

    it("does nothing when no active subscription", async () => {
      mockPushManager.getSubscription.mockResolvedValue(null);
      await unsubscribeFromPush();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("getCurrentSubscription", () => {
    it("returns null when no subscription", async () => {
      const sub = await getCurrentSubscription();
      expect(sub).toBeNull();
    });

    it("returns the current subscription", async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);
      const sub = await getCurrentSubscription();
      expect(sub).toBe(mockSubscription);
    });
  });
});
