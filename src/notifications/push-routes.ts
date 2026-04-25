/**
 * Express routes for Web Push notification management.
 * Shared by src/server/server.ts (dev server) and electron/main.ts.
 *
 * Usage:
 *   import { registerPushRoutes } from "./push-routes.js";
 *   registerPushRoutes(app);
 */

import webpush from "web-push";
import {
  getOrCreateVapidKeys,
  saveSubscription,
  removeSubscription,
  removeSubscriptionById,
  getSubscription,
  getAllSubscriptions,
} from "./push-store.js";
import type { Express, Request, Response } from "express";

/**
 * Broadcast a push notification payload to all subscriptions.
 * Used by both the /push/broadcast route and the server-side task scheduler.
 */
export async function broadcastPush(
  payload: any,
): Promise<{ sent: number; failed: number; noSubscribers?: true }> {
  const subs = getAllSubscriptions();

  if (subs.length === 0) {
    return { sent: 0, failed: 0, noSubscribers: true };
  }

  const keys = getOrCreateVapidKeys();
  const notification = JSON.stringify(payload);
  const options = {
    TTL: 60 * 60,
    vapidDetails: {
      subject: keys.subject,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    },
  };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
      };

      try {
        await webpush.sendNotification(pushSubscription, notification, options);
        sent++;
      } catch (err: any) {
        failed++;

        if (err.statusCode === 410 || err.statusCode === 404) {
          removeSubscription(sub.endpoint);
        }
      }
    }),
  );

  return { sent, failed };
}

/**
 * Register push notification API routes on an Express app.
 */
export function registerPushRoutes(app: Express): void {
  // Return the VAPID public key so the client can subscribe
  app.get("/push/vapid-public-key", (_req, res) => {
    const keys = getOrCreateVapidKeys();
    res.json({ publicKey: keys.publicKey });
  });

  // Store a new push subscription
  app.post("/push/subscribe", (req, res) => {
    const subscription = req.body;

    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    saveSubscription(subscription);
    res.sendStatus(201);
  });

  // Remove a push subscription by endpoint
  app.delete("/push/subscribe", (req, res) => {
    const { endpoint } = req.body || {};

    if (!endpoint) {
      return res.status(400).json({ error: "Missing endpoint" });
    }

    removeSubscription(endpoint);
    res.sendStatus(200);
  });

  // List all stored subscriptions (for management UI)
  app.get("/push/subscriptions", (_req, res) => {
    const subs = getAllSubscriptions();
    res.json(subs);
  });

  // Send a notification to a specific subscription
  app.post("/push/send", async (req, res) => {
    const { endpoint, payload } = req.body || {};

    if (!endpoint) {
      return res.status(400).json({ error: "Missing endpoint" });
    }

    const sub = getSubscription(endpoint);

    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const keys = getOrCreateVapidKeys();

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth,
      },
    };

    const notification = JSON.stringify({
      title: "ShadowClaw",
      body: payload || "Test notification",
    });

    const options = {
      TTL: 60 * 60, // 1 hour
      vapidDetails: {
        subject: keys.subject,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, notification, options);
      res.sendStatus(200);
    } catch (err: any) {
      console.error("Push send failed:", err.message);

      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or invalid — clean up
        removeSubscription(endpoint);

        return res
          .status(410)
          .json({ error: "Subscription expired, removed from store" });
      }

      res.status(500).json({ error: err.message });
    }
  });

  // Delete a subscription by its row ID
  app.delete("/push/subscription/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid subscription ID" });
    }

    removeSubscriptionById(id);
    res.sendStatus(200);
  });

  // Broadcast a notification to all subscriptions
  app.post("/push/broadcast", async (req, res) => {
    const { title, body } = req.body || {};

    if (!body) {
      return res.status(400).json({ error: "Missing body" });
    }

    try {
      const result = await broadcastPush({
        title: title || "ShadowClaw",
        body,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
