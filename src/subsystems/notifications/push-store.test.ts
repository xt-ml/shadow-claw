import {
  openPushStore,
  closePushStore,
  getOrCreateVapidKeys,
  saveSubscription,
  removeSubscription,
  getSubscription,
  getAllSubscriptions,
  removeSubscriptionById,
  getSubscriptionsByClientId,
  getSubscriptionsBySubscriberId,
  findSubscriptionsForClient,
  getRegisteredPushClients,
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

  describe("client-targeted subscriptions", () => {
    it("stores and retrieves subscriptions with clientId and deviceLabel", () => {
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        clientId: "client-01jtest123",
        deviceLabel: "Pixel 9 Pro",
      });

      const sub = getSubscription(MOCK_SUBSCRIPTION.endpoint);
      expect(sub).toBeDefined();
      expect(sub?.client_id).toBe("client-01jtest123");
      expect(sub?.device_label).toBe("Pixel 9 Pro");

      const byClient = getSubscriptionsByClientId("client-01jtest123");
      expect(byClient).toHaveLength(1);
      expect(byClient[0].endpoint).toBe(MOCK_SUBSCRIPTION.endpoint);
    });

    it("finds subscriptions by exact clientId, prefix, device label, and row ID", () => {
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        clientId: "client-01jtest123",
        deviceLabel: "Pixel 9 Pro",
      });
      saveSubscription({
        ...MOCK_SUBSCRIPTION_2,
        clientId: "client-02ktest456",
        deviceLabel: "MacBook Air",
      });

      // Exact clientId
      const exact = findSubscriptionsForClient("client-01jtest123");
      expect(exact).toHaveLength(1);
      expect(exact[0].endpoint).toBe(MOCK_SUBSCRIPTION.endpoint);

      // Prefix clientId without 'client-'
      const prefix = findSubscriptionsForClient("01jtest");
      expect(prefix).toHaveLength(1);
      expect(prefix[0].endpoint).toBe(MOCK_SUBSCRIPTION.endpoint);

      // Device label substring (case-insensitive)
      const byLabel = findSubscriptionsForClient("macbook");
      expect(byLabel).toHaveLength(1);
      expect(byLabel[0].endpoint).toBe(MOCK_SUBSCRIPTION_2.endpoint);

      // Row ID
      const all = getAllSubscriptions();
      const byId = findSubscriptionsForClient(String(all[0].id));
      expect(byId).toHaveLength(1);
      expect(byId[0].id).toBe(all[0].id);

      // Non-existent target
      const notFound = findSubscriptionsForClient("nonexistent-device");
      expect(notFound).toHaveLength(0);
    });
  });

  describe("getRegisteredPushClients", () => {
    it("returns empty array when no subscriptions exist", () => {
      expect(getRegisteredPushClients()).toEqual([]);
    });

    it("returns deduplicated registered push clients with device labels and counts", () => {
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        clientId: "client-01jtest123",
        deviceLabel: "Pixel 9 Pro",
      });
      // Second subscription from same client (e.g. renewed endpoint)
      saveSubscription({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123-renewed",
        keys: MOCK_SUBSCRIPTION.keys,
        clientId: "client-01jtest123",
        deviceLabel: "Pixel 9 Pro",
      });
      // Different client
      saveSubscription({
        ...MOCK_SUBSCRIPTION_2,
        clientId: "client-02ktest456",
        deviceLabel: "MacBook Air",
      });

      const clients = getRegisteredPushClients();
      expect(clients).toHaveLength(2);

      const client1 = clients.find((c) => c.clientId === "client-01jtest123");
      expect(client1).toBeDefined();
      expect(client1?.deviceLabel).toBe("Pixel 9 Pro");
      expect(client1?.subscriptionCount).toBe(2);

      const client2 = clients.find((c) => c.clientId === "client-02ktest456");
      expect(client2).toBeDefined();
      expect(client2?.deviceLabel).toBe("MacBook Air");
      expect(client2?.subscriptionCount).toBe(1);
    });

    it("falls back to subscription id when clientId is omitted", () => {
      saveSubscription(MOCK_SUBSCRIPTION);
      const clients = getRegisteredPushClients();
      expect(clients).toHaveLength(1);
      const all = getAllSubscriptions();
      expect(clients[0].clientId).toBe(String(all[0].id));
    });
  });

  describe("subscriber-targeted subscriptions", () => {
    it("stores and retrieves subscriptions with subscriberId (both camelCase and snake_case input)", () => {
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        subscriberId: "sub-12345",
      });

      const sub = getSubscription(MOCK_SUBSCRIPTION.endpoint);
      expect(sub).toBeDefined();
      expect(sub?.subscriber_id).toBe("sub-12345");

      saveSubscription({
        ...MOCK_SUBSCRIPTION_2,
        subscriber_id: "sub-67890",
      });

      const sub2 = getSubscription(MOCK_SUBSCRIPTION_2.endpoint);
      expect(sub2).toBeDefined();
      expect(sub2?.subscriber_id).toBe("sub-67890");
    });

    it("upsert preserves existing subscriber_id when omitted, but updates when provided", () => {
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        subscriberId: "sub-initial",
      });

      // Update without subscriberId
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        deviceLabel: "New Device Label",
      });

      let sub = getSubscription(MOCK_SUBSCRIPTION.endpoint);
      expect(sub?.subscriber_id).toBe("sub-initial");
      expect(sub?.device_label).toBe("New Device Label");

      // Update with new subscriberId
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        subscriberId: "sub-updated",
      });

      sub = getSubscription(MOCK_SUBSCRIPTION.endpoint);
      expect(sub?.subscriber_id).toBe("sub-updated");
    });

    it("getSubscriptionsBySubscriberId filters subscriptions accurately", () => {
      saveSubscription({
        ...MOCK_SUBSCRIPTION,
        subscriberId: "sub-alpha",
      });
      saveSubscription({
        ...MOCK_SUBSCRIPTION_2,
        subscriberId: "sub-beta",
      });

      const alphaSubs = getSubscriptionsBySubscriberId("sub-alpha");
      expect(alphaSubs).toHaveLength(1);
      expect(alphaSubs[0].endpoint).toBe(MOCK_SUBSCRIPTION.endpoint);
      expect(alphaSubs[0].subscriber_id).toBe("sub-alpha");

      const notFound = getSubscriptionsBySubscriberId("sub-nonexistent");
      expect(notFound).toEqual([]);

      const empty = getSubscriptionsBySubscriberId("");
      expect(empty).toEqual([]);
    });

    it("migrates existing subscriptions table without subscriber_id column seamlessly", async () => {
      closePushStore();
      const fs = await import("node:fs");
      const path = await import("node:path");
      const os = await import("node:os");
      const { DatabaseSync } = await import("node:sqlite");

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "push-store-mig-"));
      const tempDbPath = path.join(tempDir, "old-push.db");

      try {
        const rawDb = new DatabaseSync(tempDbPath);
        rawDb.exec(`
          CREATE TABLE subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint TEXT NOT NULL UNIQUE,
            keys_p256dh TEXT NOT NULL,
            keys_auth TEXT NOT NULL,
            client_id TEXT,
            device_label TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `);
        rawDb
          .prepare(
            `
          INSERT INTO subscriptions (endpoint, keys_p256dh, keys_auth, client_id)
          VALUES ('https://old.endpoint', 'p256', 'auth', 'client-old')
        `,
          )
          .run();
        rawDb.close();

        // Now open with openPushStore - should run ALTER TABLE without throwing
        openPushStore(tempDbPath);
        const sub = getSubscription("https://old.endpoint");
        expect(sub).toBeDefined();
        expect(sub?.client_id).toBe("client-old");
        expect(sub?.subscriber_id).toBeUndefined();

        // And saving with subscriberId should work
        saveSubscription({
          endpoint: "https://old.endpoint",
          keys: { p256dh: "p256", auth: "auth" },
          subscriberId: "sub-migrated",
        });

        const updated = getSubscription("https://old.endpoint");
        expect(updated?.subscriber_id).toBe("sub-migrated");
      } finally {
        closePushStore();
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (_) {}
      }
    });
  });
});
