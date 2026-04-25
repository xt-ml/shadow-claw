import { jest } from "@jest/globals";

import {
  openPushStore,
  closePushStore,
  getOrCreateVapidKeys,
  saveSubscription,
  removeSubscription,
  getSubscription,
  getAllSubscriptions,
  removeSubscriptionById,
} from "./push-store.js";

// Use in-memory DB for tests
beforeEach(() => {
  openPushStore(":memory:");
});

afterEach(() => {
  closePushStore();
});

const MOCK_SUBSCRIPTION: any = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BNYDjQL9d5PSoeBurHy2e4d4GY0sGJXBN_test",
    auth: "0IyyvUGNJ9RxJc83poo3bA",
  },
};

const MOCK_SUBSCRIPTION_2: any = {
  endpoint: "https://fcm.googleapis.com/fcm/send/def456",
  keys: {
    p256dh: "BNYDjQL9d5PSoeBurHy2e4d4GY0sGJXBN_test2",
    auth: "1JzzvVHOK0SyKd94qpp4cB",
  },
};

describe("push-store", () => {
  describe("openPushStore", () => {
    it("creates tables on first open", () => {
      // Verify tables exist by querying them (no error = success)
      const db = openPushStore(":memory:");
      const subs = db.prepare("SELECT * FROM subscriptions").all();
      expect(subs).toEqual([]);
    });
  });

  describe("getOrCreateVapidKeys", () => {
    it("generates and stores VAPID keys on first call", () => {
      const keys = getOrCreateVapidKeys();
      expect(keys).toHaveProperty("publicKey");
      expect(keys).toHaveProperty("privateKey");
      expect(keys).toHaveProperty("subject");
      expect(keys.publicKey).toBeTruthy();
      expect(keys.privateKey).toBeTruthy();
    });

    it("returns same keys on subsequent calls", () => {
      const keys1 = getOrCreateVapidKeys();
      const keys2 = getOrCreateVapidKeys();
      expect(keys1.publicKey).toBe(keys2.publicKey);
      expect(keys1.privateKey).toBe(keys2.privateKey);
    });

    it("uses custom subject", () => {
      const keys = getOrCreateVapidKeys("mailto:custom@example.com");
      expect(keys.subject).toBe("mailto:custom@example.com");
    });
  });

  describe("saveSubscription", () => {
    it("stores a new subscription", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      const all = getAllSubscriptions();
      expect(all).toHaveLength(1);
      expect(all[0].endpoint).toBe(MOCK_SUBSCRIPTION.endpoint);
      expect(all[0].keys_p256dh).toBe(MOCK_SUBSCRIPTION.keys.p256dh);
      expect(all[0].keys_auth).toBe(MOCK_SUBSCRIPTION.keys.auth);
    });

    it("replaces subscription with same endpoint", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      saveSubscription({
        endpoint: MOCK_SUBSCRIPTION.endpoint,
        keys: { p256dh: "updated_key", auth: "updated_auth" },
      });
      const all = getAllSubscriptions();
      expect(all).toHaveLength(1);
      expect(all[0].keys_p256dh).toBe("updated_key");
    });

    it("stores multiple different subscriptions", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      saveSubscription(MOCK_SUBSCRIPTION_2);
      const all = getAllSubscriptions();
      expect(all).toHaveLength(2);
    });
  });

  describe("removeSubscription", () => {
    it("removes a subscription by endpoint", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      saveSubscription(MOCK_SUBSCRIPTION_2);
      removeSubscription(MOCK_SUBSCRIPTION.endpoint);
      const all = getAllSubscriptions();
      expect(all).toHaveLength(1);
      expect(all[0].endpoint).toBe(MOCK_SUBSCRIPTION_2.endpoint);
    });

    it("does not throw for non-existent endpoint", () => {
      expect(() => removeSubscription("nonexistent")).not.toThrow();
    });
  });

  describe("removeSubscriptionById", () => {
    it("removes a subscription by row ID", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      const all = getAllSubscriptions();
      removeSubscriptionById(all[0].id);
      expect(getAllSubscriptions()).toHaveLength(0);
    });
  });

  describe("getSubscription", () => {
    it("returns a subscription by endpoint", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      const sub = getSubscription(MOCK_SUBSCRIPTION.endpoint);
      expect(sub).toBeTruthy();

      expect(sub!.endpoint).toBe(MOCK_SUBSCRIPTION.endpoint);
    });

    it("returns undefined for non-existent endpoint", () => {
      const sub = getSubscription("nonexistent");
      expect(sub).toBeUndefined();
    });
  });

  describe("getAllSubscriptions", () => {
    it("returns empty array when no subscriptions", () => {
      expect(getAllSubscriptions()).toEqual([]);
    });

    it("returns subscriptions ordered by created_at DESC", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      saveSubscription(MOCK_SUBSCRIPTION_2);
      const all = getAllSubscriptions();
      // Most recently added should come first
      expect(all[0].endpoint).toBe(MOCK_SUBSCRIPTION_2.endpoint);
    });
  });
});
