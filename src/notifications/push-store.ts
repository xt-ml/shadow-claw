/**
 * Push notification subscription store backed by node:sqlite.
 *
 * Usage:
 *   import { openPushStore, getOrCreateVapidKeys, saveSubscription } from "./push-store.js";
 *   openPushStore();  // opens/creates DB file
 */

import { DatabaseSync } from "node:sqlite";
import webpush from "web-push";

const DEFAULT_VAPID_SUBJECT = "mailto:admin@shadowclaw.app";

let db: DatabaseSync | null = null;

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Open (or create) the push subscriptions SQLite database.
 */
export function openPushStore(
  dbPath: string = "database/push-subscriptions.db",
): DatabaseSync {
  if (db) {
    return db;
  }

  db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vapid_keys (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      subject TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

/**
 * Close the push store database.
 */
export function closePushStore(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get or generate VAPID keys. Keys are generated once and persisted.
 */
export function getOrCreateVapidKeys(
  subject: string = DEFAULT_VAPID_SUBJECT,
): VapidKeys {
  if (!db) {
    throw new Error("Push store not opened. Call openPushStore() first.");
  }

  const row = db.prepare("SELECT * FROM vapid_keys WHERE id = 1").get();

  if (row) {
    return {
      publicKey: `${row.public_key}`,
      privateKey: `${row.private_key}`,
      subject: `${row.subject}`,
    };
  }

  const keys = webpush.generateVAPIDKeys();

  db.prepare(
    "INSERT INTO vapid_keys (id, public_key, private_key, subject) VALUES (1, ?, ?, ?)",
  ).run(keys.publicKey, keys.privateKey, subject);

  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject,
  };
}

/**
 * Save a push subscription (upsert by endpoint).
 */
export function saveSubscription(subscription: PushSubscriptionInput): void {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  db.prepare(
    "INSERT OR REPLACE INTO subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)",
  ).run(
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
  );
}

/**
 * Remove a subscription by endpoint.
 */
export function removeSubscription(endpoint: string): void {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  db.prepare("DELETE FROM subscriptions WHERE endpoint = ?").run(endpoint);
}

/**
 * Remove a subscription by its row ID.
 */
export function removeSubscriptionById(id: number): void {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  db.prepare("DELETE FROM subscriptions WHERE id = ?").run(id);
}

/**
 * Get a single subscription by endpoint.
 */
export function getSubscription(
  endpoint: string,
): PushSubscriptionRow | undefined {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  const result = db
    .prepare("SELECT * FROM subscriptions WHERE endpoint = ?")
    .get(endpoint);

  return result
    ? {
        id: Number(result.id),
        endpoint: `${result.endpoint}`,
        keys_p256dh: `${result.keys_p256dh}`,
        keys_auth: `${result.keys_auth}`,
        created_at: `${result.created_at}`,
      }
    : undefined;
}

/**
 * Get all stored subscriptions, newest first.
 */
export function getAllSubscriptions(): PushSubscriptionRow[] {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  const result = db
    .prepare("SELECT * FROM subscriptions ORDER BY created_at DESC")
    .all();

  return result
    ? result.map((row) => ({
        id: Number(row.id),
        endpoint: `${row.endpoint}`,
        keys_p256dh: `${row.keys_p256dh}`,
        keys_auth: `${row.keys_auth}`,
        created_at: `${row.created_at}`,
      }))
    : [];
}
