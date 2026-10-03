import { jest, beforeEach } from "@jest/globals";

// Mock web-push
jest.unstable_mockModule("web-push", () => ({
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: (jest.fn() as any).mockResolvedValue({
      statusCode: 201,
      body: "",
    } as any),
  },
}));

// Mock the push store
jest.unstable_mockModule("./push-store.js", () => ({
  getOrCreateVapidKeys: jest.fn(() => ({
    publicKey: "test-public-key",
    privateKey: "test-private-key",
    subject: "mailto:test@test.test",
  })),
  saveSubscription: jest.fn(),
  removeSubscription: jest.fn(),
  removeSubscriptionById: jest.fn(),
  getSubscription: jest.fn(),
  getAllSubscriptions: jest.fn(() => []),
  getSubscriptionsByClientId: jest.fn(() => []),
  getSubscriptionsBySubscriberId: jest.fn(() => []),
  findSubscriptionsForClient: jest.fn(() => []),
  getRegisteredPushClients: jest.fn(() => []),
}));

const { registerPushRoutes, broadcastPush } = await import("./push-routes.js");
const store = await import("./push-store.js");
const webpush = (await import("web-push")).default;

// Minimal Express-like test helpers
function createMockApp() {
  const routes: any = { get: {}, post: {}, delete: {} };

  return {
    get(path: string, handler: Function) {
      routes.get[path] = handler;
    },
    post(path: string, handler: Function) {
      routes.post[path] = handler;
    },
    delete(path: string, handler: Function) {
      routes.delete[path] = handler;
    },
    routes,
  };
}

function createMockReq(body = {}) {
  return { body };
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    _json: null,
    _sent: false,
    json(data) {
      res._json = data;

      return res;
    },
    status(code) {
      res.statusCode = code;

      return res;
    },
    sendStatus(code) {
      res.statusCode = code;
      res._sent = true;

      return res;
    },
  };

  return res;
}

describe("push-routes", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createMockApp();
    registerPushRoutes(app);
  });

  describe("GET /push/vapid-public-key", () => {
    it("registers the route", () => {
      expect(app.routes.get["/push/vapid-public-key"]).toBeDefined();
    });

    it("returns the VAPID public key", async () => {
      const req = createMockReq();
      const res = createMockRes();
      await app.routes.get["/push/vapid-public-key"](req, res);
      expect(res._json).toEqual({ publicKey: "test-public-key" });
    });
  });

  describe("POST /push/subscribe", () => {
    it("registers the route", () => {
      expect(app.routes.post["/push/subscribe"]).toBeDefined();
    });

    it("saves the subscription and returns 201", async () => {
      const subscription: any = {
        endpoint: "https://fcm.example.com/abc",
        keys: { p256dh: "key1", auth: "key2" },
      };
      const req = createMockReq(subscription);
      const res = createMockRes();
      await app.routes.post["/push/subscribe"](req, res);
      expect(store.saveSubscription).toHaveBeenCalledWith({
        ...subscription,
        clientId: undefined,
        deviceLabel: undefined,
      });
      expect(res.statusCode).toBe(201);
    });

    it("saves the subscription with clientId and deviceLabel", async () => {
      const subscription: any = {
        endpoint: "https://fcm.example.com/abc-with-client",
        keys: { p256dh: "key1", auth: "key2" },
        clientId: "client-test-777",
        deviceLabel: "Test Device 777",
      };
      const req = createMockReq(subscription);
      const res = createMockRes();
      await app.routes.post["/push/subscribe"](req, res);
      expect(store.saveSubscription).toHaveBeenCalledWith({
        ...subscription,
        subscriberId: undefined,
      });
      expect(res.statusCode).toBe(201);
    });

    it("saves the subscription with subscriberId from body or query", async () => {
      const subscription: any = {
        endpoint: "https://fcm.example.com/abc-with-sub",
        keys: { p256dh: "key1", auth: "key2" },
        subscriberId: "sub-ipad-999",
      };
      const req = createMockReq(subscription);
      const res = createMockRes();
      await app.routes.post["/push/subscribe"](req, res);
      expect(store.saveSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://fcm.example.com/abc-with-sub",
          subscriberId: "sub-ipad-999",
        }),
      );

      // Also support subscriber_id snake_case
      const subSnake: any = {
        endpoint: "https://fcm.example.com/abc-snake",
        keys: { p256dh: "key1", auth: "key2" },
        subscriber_id: "sub-snake-123",
      };
      await app.routes.post["/push/subscribe"](
        createMockReq(subSnake),
        createMockRes(),
      );
      expect(store.saveSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://fcm.example.com/abc-snake",
          subscriberId: "sub-snake-123",
        }),
      );

      // Also support query param ?subscriberId=...
      const reqQuery: any = {
        body: {
          endpoint: "https://fcm.example.com/abc-query",
          keys: { p256dh: "key1", auth: "key2" },
        },
        query: { subscriberId: "sub-from-query" },
      };
      await app.routes.post["/push/subscribe"](reqQuery, createMockRes());
      expect(store.saveSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://fcm.example.com/abc-query",
          subscriberId: "sub-from-query",
        }),
      );
    });
  });

  describe("DELETE /push/subscribe", () => {
    it("registers the route", () => {
      expect(app.routes.delete["/push/subscribe"]).toBeDefined();
    });

    it("removes the subscription by endpoint", async () => {
      const req = createMockReq({
        endpoint: "https://fcm.example.com/abc",
      });
      const res = createMockRes();
      await app.routes.delete["/push/subscribe"](req, res);
      expect(store.removeSubscription).toHaveBeenCalledWith(
        "https://fcm.example.com/abc",
      );
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /push/subscriptions", () => {
    it("registers the route", () => {
      expect(app.routes.get["/push/subscriptions"]).toBeDefined();
    });

    it("returns all subscriptions", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/abc",
          keys_p256dh: "k1",
          keys_auth: "k2",
          created_at: "2026-01-01",
        },
      ]);
      const req = createMockReq();
      const res = createMockRes();
      await app.routes.get["/push/subscriptions"](req, res);
      expect(res._json).toHaveLength(1);

      expect(res._json[0].id).toBe(1);
    });
  });

  describe("GET /push/clients", () => {
    it("registers the route", () => {
      expect(app.routes.get["/push/clients"]).toBeDefined();
    });

    it("returns registered push clients", async () => {
      (store.getRegisteredPushClients as any).mockReturnValue([
        {
          clientId: "client-abc",
          deviceLabel: "Mac Chrome",
          subscriptionCount: 1,
          lastSeen: "2026-09-01",
        },
      ]);
      const req = createMockReq();
      const res = createMockRes();
      await app.routes.get["/push/clients"](req, res);
      expect(res._json).toEqual({
        clients: [
          {
            clientId: "client-abc",
            deviceLabel: "Mac Chrome",
            subscriptionCount: 1,
            lastSeen: "2026-09-01",
          },
        ],
      });
    });
  });

  describe("POST /push/send", () => {
    it("registers the route", () => {
      expect(app.routes.post["/push/send"]).toBeDefined();
    });

    it("sends notification to a specific subscription", async () => {
      (store.getSubscription as any).mockReturnValue({
        id: 1,
        endpoint: "https://fcm.example.com/abc",
        keys_p256dh: "k1",
        keys_auth: "k2",
      });
      const req = createMockReq({
        endpoint: "https://fcm.example.com/abc",
        payload: "Hello World",
      });
      const res = createMockRes();
      await app.routes.post["/push/send"](req, res);
      expect(webpush.sendNotification).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it("returns 404 when subscription not found", async () => {
      (store.getSubscription as any).mockReturnValue(undefined);
      const req = createMockReq({
        endpoint: "https://fcm.example.com/nonexistent",
        payload: "Hello",
      });
      const res = createMockRes();
      await app.routes.post["/push/send"](req, res);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /push/subscription/:id", () => {
    it("registers the route", () => {
      expect(app.routes.delete["/push/subscription/:id"]).toBeDefined();
    });

    it("removes subscription by ID", async () => {
      const req: any = { params: { id: "5" } };
      const res = createMockRes();
      await app.routes.delete["/push/subscription/:id"](req, res);
      expect(store.removeSubscriptionById).toHaveBeenCalledWith(5);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /push/broadcast", () => {
    it("registers the route", () => {
      expect(app.routes.post["/push/broadcast"]).toBeDefined();
    });

    it("sends notification to all subscriptions", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/aaa",
          keys_p256dh: "k1",
          keys_auth: "k2",
        },
        {
          id: 2,
          endpoint: "https://fcm.example.com/bbb",
          keys_p256dh: "k3",
          keys_auth: "k4",
        },
      ]);
      const req = createMockReq({
        title: "Alert",
        body: "Something happened",
      });
      const res = createMockRes();
      await app.routes.post["/push/broadcast"](req, res);
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      expect(res.statusCode).toBe(200);

      expect(res._json.sent).toBe(2);

      expect(res._json.failed).toBe(0);
    });

    it("returns 200 with zero sent when no subscriptions exist", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([]);
      const req = createMockReq({ body: "Hello" });
      const res = createMockRes();
      await app.routes.post["/push/broadcast"](req, res);
      expect(webpush.sendNotification).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);

      expect(res._json.sent).toBe(0);
    });

    it("uses default title when not provided", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/aaa",
          keys_p256dh: "k1",
          keys_auth: "k2",
        },
      ]);
      const req = createMockReq({ body: "Test message" });
      const res = createMockRes();
      await app.routes.post["/push/broadcast"](req, res);
      const notification = JSON.parse(
        webpush.sendNotification.mock.calls[0][1],
      );
      expect(notification.title).toBe("ShadowClaw");
      expect(notification.body).toBe("Test message");
    });

    it("removes expired subscriptions (410) and counts them as failed", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/good",
          keys_p256dh: "k1",
          keys_auth: "k2",
        },
        {
          id: 2,
          endpoint: "https://fcm.example.com/expired",
          keys_p256dh: "k3",
          keys_auth: "k4",
        },
      ]);
      webpush.sendNotification
        .mockResolvedValueOnce({ statusCode: 201 } as any)
        .mockRejectedValueOnce({ statusCode: 410, message: "Gone" });
      const req = createMockReq({ body: "Hello" });
      const res = createMockRes();
      await app.routes.post["/push/broadcast"](req, res);
      expect(res.statusCode).toBe(200);

      expect(res._json.sent).toBe(1);

      expect(res._json.failed).toBe(1);
      expect(store.removeSubscription).toHaveBeenCalledWith(
        "https://fcm.example.com/expired",
      );
    });

    it("returns 400 when body is missing", async () => {
      const req = createMockReq({} as any);
      const res = createMockRes();
      await app.routes.post["/push/broadcast"](req, res);
      expect(res.statusCode).toBe(400);
    });

    it("targets a specific client when clientId is provided in POST /push/broadcast", async () => {
      (store.findSubscriptionsForClient as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/client-specific",
          keys_p256dh: "k1",
          keys_auth: "k2",
          client_id: "client-target-99",
        },
      ]);
      webpush.sendNotification.mockResolvedValueOnce({
        statusCode: 201,
      } as any);

      const req = createMockReq({
        body: "Specific client alert",
        clientId: "client-target-99",
      });
      const res = createMockRes();
      await app.routes.post["/push/broadcast"](req, res);
      expect(res.statusCode).toBe(200);
      expect(store.findSubscriptionsForClient).toHaveBeenCalledWith(
        "client-target-99",
      );
      expect(res._json.sent).toBe(1);
    });
  });

  describe("POST /push/command", () => {
    it("registers the route", () => {
      expect(app.routes.post["/push/command"]).toBeDefined();
    });

    it("broadcasts remote-command payload to subscribers", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/sub1",
          keys_p256dh: "k1",
          keys_auth: "k2",
        },
      ]);
      const req = createMockReq({
        action: "send-message",
        clientId: "client-target",
        args: { text: "Wake up" },
      });
      const res = createMockRes();
      await app.routes.post["/push/command"](req, res);
      expect(res.statusCode).toBe(200);
      expect(res._json.sent).toBe(1);
    });

    it("returns 400 when action is missing", async () => {
      const req = createMockReq({});
      const res = createMockRes();
      await app.routes.post["/push/command"](req, res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("broadcastPush()", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns noSubscribers: true when no subscriptions exist", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([]);
      const result = await broadcastPush({ title: "Test", body: "Hello" });
      expect(result).toEqual({ sent: 0, failed: 0, noSubscribers: true });
    });

    it("does NOT return noSubscribers when subscribers exist", async () => {
      (store.getAllSubscriptions as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/sub1",
          keys_p256dh: "k1",
          keys_auth: "k2",
        },
      ]);
      const result = await broadcastPush({ title: "Test", body: "Hello" });
      expect(result.noSubscribers).toBeUndefined();
      expect(result.sent).toBe(1);
    });

    it("targets a specific client and returns notFound when no subscription matches", async () => {
      (store.findSubscriptionsForClient as any).mockReturnValue([]);
      const result = await broadcastPush(
        { title: "Test", body: "Hello" },
        { clientId: "unknown-client" },
      );
      expect(result).toEqual({ sent: 0, failed: 0, notFound: true });
      expect(store.findSubscriptionsForClient).toHaveBeenCalledWith(
        "unknown-client",
      );
    });

    it("targets a specific client and sends push when matching subscription exists", async () => {
      (store.findSubscriptionsForClient as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/target-sub",
          keys_p256dh: "k1",
          keys_auth: "k2",
          client_id: "client-target-123",
        },
      ]);
      webpush.sendNotification.mockResolvedValueOnce({
        statusCode: 201,
      } as any);
      const result = await broadcastPush(
        { title: "Test", body: "Hello" },
        { clientId: "client-target-123" },
      );
      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(store.findSubscriptionsForClient).toHaveBeenCalledWith(
        "client-target-123",
      );
    });

    it("targets a specific subscriber and sends push when matching subscription exists", async () => {
      (store.getSubscriptionsBySubscriberId as any).mockReturnValue([
        {
          id: 1,
          endpoint: "https://fcm.example.com/target-sub",
          keys_p256dh: "k1",
          keys_auth: "k2",
          subscriber_id: "sub-owner-123",
        },
      ]);
      webpush.sendNotification.mockResolvedValueOnce({
        statusCode: 201,
      } as any);

      const result = await broadcastPush(
        { title: "Test", body: "Hello" },
        { subscriberId: "sub-owner-123" },
      );
      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(store.getSubscriptionsBySubscriberId).toHaveBeenCalledWith(
        "sub-owner-123",
      );
      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    });

    it("targets a specific subscriber and returns notFound when no subscription matches", async () => {
      (store.getSubscriptionsBySubscriberId as any).mockReturnValue([]);

      const result = await broadcastPush(
        { title: "Test", body: "Hello" },
        { subscriberId: "sub-unknown" },
      );
      expect(result).toEqual({ sent: 0, failed: 0, notFound: true });
      expect(store.getSubscriptionsBySubscriberId).toHaveBeenCalledWith(
        "sub-unknown",
      );
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it("regression: broadcastPush for Knack task (subscriber sub-knack) does not send to iPad (subscriber sub-ipad)", async () => {
      // Push store only has iPad subscription
      (store.getSubscriptionsBySubscriberId as any).mockImplementation(
        (id: string) => {
          if (id === "sub-ipad") {
            return [
              {
                id: 2,
                endpoint: "https://web.push.apple.com/ipad-endpoint",
                keys_p256dh: "k-ipad",
                keys_auth: "k-auth",
                subscriber_id: "sub-ipad",
                device_label: "iPad Safari",
              },
            ];
          }
          return [];
        },
      );

      // Scheduled task on Knack triggers broadcastPush for sub-knack
      const result = await broadcastPush(
        {
          type: "scheduled-task",
          taskId: "fabf1c52-task",
          subscriberId: "sub-knack",
          prompt: "Fetch Soylent News",
        },
        { subscriberId: "sub-knack" },
      );

      // Must be notFound and zero notifications sent (iPad NEVER gets Knack's task push)
      expect(result).toEqual({ sent: 0, failed: 0, notFound: true });
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it("extracts subscriberId directly from payload if not specified in options", async () => {
      (store.getSubscriptionsBySubscriberId as any).mockReturnValue([]);

      const result = await broadcastPush({
        type: "scheduled-task",
        taskId: "task-abc",
        subscriberId: "sub-payload-123",
      });

      expect(result).toEqual({ sent: 0, failed: 0, notFound: true });
      expect(store.getSubscriptionsBySubscriberId).toHaveBeenCalledWith(
        "sub-payload-123",
      );
    });
  });
});
