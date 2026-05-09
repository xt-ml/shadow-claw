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
      expect(store.saveSubscription).toHaveBeenCalledWith(subscription);
      expect(res.statusCode).toBe(201);
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
  });
});
