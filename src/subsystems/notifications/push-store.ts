/**
 * Push notification subscription store backed by node:sqlite.
 *
 * Usage:
 *   import { openPushStore, getOrCreateVapidKeys, saveSubscription } from "./push-store.js";
 *   openPushStore();  // opens/creates DB file
 */

import { DatabaseSync } from "node:sqlite";
import webpush from "web-push";

const DEFAULT_VAPID_SUBJECT = "mailto:admin@creativeindustrial.com";

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
  client_id?: string;
  device_label?: string;
  created_at: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  clientId?: string;
  client_id?: string;
  deviceLabel?: string;
  device_label?: string;
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
      client_id TEXT,
      device_label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN client_id TEXT`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN device_label TEXT`);
  } catch (_) {}

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

function rowToSubscription(row: any): PushSubscriptionRow {
  return {
    id: Number(row.id),
    endpoint: `${row.endpoint}`,
    keys_p256dh: `${row.keys_p256dh}`,
    keys_auth: `${row.keys_auth}`,
    client_id: row.client_id ? `${row.client_id}` : undefined,
    device_label: row.device_label ? `${row.device_label}` : undefined,
    created_at: `${row.created_at}`,
  };
}

/**
 * Save a push subscription (upsert by endpoint).
 */
export function saveSubscription(subscription: PushSubscriptionInput): void {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  const clientId = subscription.clientId || subscription.client_id || null;
  const deviceLabel =
    subscription.deviceLabel || subscription.device_label || null;

  db.prepare(
    `
    INSERT INTO subscriptions (endpoint, keys_p256dh, keys_auth, client_id, device_label)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      keys_p256dh = excluded.keys_p256dh,
      keys_auth = excluded.keys_auth,
      client_id = COALESCE(excluded.client_id, subscriptions.client_id),
      device_label = COALESCE(excluded.device_label, subscriptions.device_label)
  `,
  ).run(
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    clientId,
    deviceLabel,
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

  return result ? rowToSubscription(result) : undefined;
}

/**
 * Get all stored subscriptions, newest first.
 */
export function getAllSubscriptions(): PushSubscriptionRow[] {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  const result = db
    .prepare("SELECT * FROM subscriptions ORDER BY created_at DESC, id DESC")
    .all();

  return result ? result.map(rowToSubscription) : [];
}

/**
 * Get subscriptions matching a specific client ID.
 */
export function getSubscriptionsByClientId(
  clientId: string,
): PushSubscriptionRow[] {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  const result = db
    .prepare(
      "SELECT * FROM subscriptions WHERE client_id = ? ORDER BY created_at DESC, id DESC",
    )
    .all(clientId);

  return result ? result.map(rowToSubscription) : [];
}

/**
 * Find subscriptions for a client by exact ID, row ID, ID prefix, or device label.
 */
export function findSubscriptionsForClient(
  target: string,
): PushSubscriptionRow[] {
  if (!db) {
    throw new Error("Push store not opened.");
  }

  const all = getAllSubscriptions();
  if (!target || !target.trim()) {
    return all;
  }

  const trimmed = target.trim();

  // 1. Exact match on client_id
  const exact = all.filter((s) => s.client_id === trimmed);
  if (exact.length > 0) return exact;

  // 2. Exact match on row ID if target is numeric
  const numericId = parseInt(trimmed, 10);
  if (!isNaN(numericId) && numericId.toString() === trimmed) {
    const byId = all.filter((s) => s.id === numericId);
    if (byId.length > 0) return byId;
  }

  // 3. Prefix match on client_id (e.g. ULID prefix or client- prefix)
  const prefix = all.filter(
    (s) =>
      s.client_id &&
      (s.client_id.startsWith(trimmed) ||
        s.client_id.replace(/^client-/, "").startsWith(trimmed) ||
        trimmed.startsWith(s.client_id)),
  );
  if (prefix.length > 0) return prefix;

  // 4. Case-insensitive substring match on device_label
  const byLabel = all.filter(
    (s) =>
      s.device_label &&
      s.device_label.toLowerCase().includes(trimmed.toLowerCase()),
  );
  if (byLabel.length > 0) return byLabel;

  return [];
}
