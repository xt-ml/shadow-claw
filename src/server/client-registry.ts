/**
 * ShadowClaw — Client Registry Store backed by node:sqlite
 *
 * Persists registered clients, metadata, and control tokens for the
 * WebSocket / SSE control plane.
 */

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ClientInfo, BackupRecord } from "./control-plane-types.js";

let db: DatabaseSync | null = null;

function rowToClientInfo(row: any): ClientInfo {
  let capabilities: string[] = [];
  try {
    capabilities = JSON.parse(row.capabilities);
  } catch {
    capabilities = [];
  }

  return {
    clientId: `${row.client_id}`,
    deviceLabel: `${row.device_label}`,
    capabilities,
    version: `${row.version}`,
    peerId: row.peer_id ? `${row.peer_id}` : undefined,
    connectedAt: Number(row.connected_at),
    lastSeen: Number(row.last_seen),
  };
}

/**
 * Open (or create) the client registry SQLite database.
 */
export function openClientStore(
  dbPath: string = "database/clients.db",
): DatabaseSync {
  if (db) {
    return db;
  }

  db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      client_id TEXT PRIMARY KEY,
      device_label TEXT NOT NULL,
      capabilities TEXT NOT NULL,
      version TEXT NOT NULL,
      peer_id TEXT,
      connected_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    )
  `);

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN peer_id TEXT`);
  } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      file_count INTEGER NOT NULL,
      total_bytes INTEGER NOT NULL,
      manifest TEXT
    )
  `);

  return db;
}

/**
 * Close the client registry database.
 */
export function closeClientStore(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Register or update a connected client.
 */
export function registerClient(client: {
  clientId: string;
  deviceLabel: string;
  capabilities: string[];
  version: string;
  peerId?: string;
}): ClientInfo {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  const now = Date.now();
  const existing = getClient(client.clientId);
  const connectedAt = existing ? existing.connectedAt : now;
  const peerId = client.peerId || existing?.peerId || null;
  const capabilitiesJson = JSON.stringify(client.capabilities || []);

  db.prepare(
    `
    INSERT INTO clients (client_id, device_label, capabilities, version, peer_id, connected_at, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET
      device_label = excluded.device_label,
      capabilities = excluded.capabilities,
      version = excluded.version,
      peer_id = excluded.peer_id,
      last_seen = excluded.last_seen
  `,
  ).run(
    client.clientId,
    client.deviceLabel,
    capabilitiesJson,
    client.version,
    peerId,
    connectedAt,
    now,
  );

  return {
    clientId: client.clientId,
    deviceLabel: client.deviceLabel,
    capabilities: client.capabilities,
    version: client.version,
    peerId: peerId || undefined,
    connectedAt,
    lastSeen: now,
  };
}

/**
 * Update the lastSeen timestamp for a client.
 */
export function updateClientHeartbeat(
  clientId: string,
  timestamp: number = Date.now(),
): boolean {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  const result = db
    .prepare("UPDATE clients SET last_seen = ? WHERE client_id = ?")
    .run(timestamp, clientId);

  return Number(result.changes) > 0;
}

/**
 * Remove a registered client.
 */
export function unregisterClient(clientId: string): boolean {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  const result = db
    .prepare("DELETE FROM clients WHERE client_id = ?")
    .run(clientId);

  return Number(result.changes) > 0;
}

/**
 * Retrieve a registered client by ID.
 */
export function getClient(clientId: string): ClientInfo | null {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  const row = db
    .prepare("SELECT * FROM clients WHERE client_id = ?")
    .get(clientId);

  return row ? rowToClientInfo(row) : null;
}

/**
 * Get all registered clients ordered by last seen.
 */
export function getAllClients(): ClientInfo[] {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  const rows = db
    .prepare("SELECT * FROM clients ORDER BY last_seen DESC")
    .all();

  return rows.map(rowToClientInfo);
}

/**
 * Prune clients that have not sent a heartbeat within maxAgeMs.
 */
export function pruneStaleClients(
  maxAgeMs: number,
  now: number = Date.now(),
): number {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  const cutoff = now - maxAgeMs;
  const result = db
    .prepare("DELETE FROM clients WHERE last_seen < ?")
    .run(cutoff);

  return Number(result.changes);
}

/**
 * Interface for the persisted control token file.
 */
export interface ControlTokenFile {
  token: string;
  createdAt: number;
  createdAtIso: string;
}

/**
 * Resolve the path to .cache/control-token.json
 */
export function getControlTokenFilePath(cacheDir?: string): string {
  if (cacheDir) {
    return path.join(cacheDir, "control-token.json");
  }
  return path.join(process.cwd(), ".cache", "control-token.json");
}

/**
 * Save the control token and timestamp to .cache/control-token.json
 */
export function saveControlTokenFile(
  token: string,
  cacheDir?: string,
  createdAt: number = Date.now(),
): ControlTokenFile {
  const filePath = getControlTokenFilePath(cacheDir);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }

  let created = createdAt;
  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (existing && existing.token === token && existing.createdAt) {
        created = Number(existing.createdAt);
      }
    } catch (_) {}
  }

  const payload: ControlTokenFile = {
    token,
    createdAt: created,
    createdAtIso: new Date(created).toISOString(),
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  } catch (_) {}

  return payload;
}

/**
 * Read the control token and timestamp from .cache/control-token.json
 */
export function readControlTokenFile(
  cacheDir?: string,
): ControlTokenFile | null {
  const filePath = getControlTokenFilePath(cacheDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string" && parsed.token.trim()) {
      const created = Number(parsed.createdAt) || Date.now();
      return {
        token: parsed.token.trim(),
        createdAt: created,
        createdAtIso: parsed.createdAtIso || new Date(created).toISOString(),
      };
    }
  } catch (_) {}
  return null;
}

/**
 * Generate a cryptographically secure random control token (32 bytes = 64 hex characters = 256 bits).
 */
export function generateControlToken(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Get or generate a persistent control token for authenticating control-plane commands.
 */
export function getOrCreateControlToken(
  configuredToken?: string,
  cacheDir?: string,
): string {
  if (configuredToken) {
    saveControlTokenFile(configuredToken, cacheDir);
    if (db) {
      db.prepare(
        `
        INSERT INTO metadata (key, value)
        VALUES ('control_token', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ).run(configuredToken);
    }
    return configuredToken;
  }

  // 1. Check if token file already exists in .cache/control-token.json
  const existingFile = readControlTokenFile(cacheDir);
  if (existingFile?.token) {
    if (db) {
      db.prepare(
        `
        INSERT INTO metadata (key, value)
        VALUES ('control_token', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ).run(existingFile.token);
    }
    return existingFile.token;
  }

  // 2. Check if token exists in SQLite metadata table
  if (db) {
    const row = db
      .prepare("SELECT value FROM metadata WHERE key = 'control_token'")
      .get() as { value: string } | undefined;

    if (row?.value) {
      const token = `${row.value}`;
      saveControlTokenFile(token, cacheDir);
      return token;
    }
  }

  // 3. Generate new cryptographically secure random token and persist to file + SQLite
  const token = generateControlToken();
  saveControlTokenFile(token, cacheDir);

  if (db) {
    db.prepare(
      `
      INSERT INTO metadata (key, value)
      VALUES ('control_token', ?)
    `,
    ).run(token);
  }

  return token;
}

/**
 * Record a completed backup in the database.
 */
export function recordBackup(backup: {
  id: string;
  clientId: string;
  timestamp?: number;
  fileCount: number;
  totalBytes: number;
  manifest?: any;
}): BackupRecord {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  const timestamp = backup.timestamp || Date.now();
  const manifestJson = backup.manifest ? JSON.stringify(backup.manifest) : null;

  db.prepare(
    `
    INSERT INTO backups (id, client_id, timestamp, file_count, total_bytes, manifest)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      timestamp = excluded.timestamp,
      file_count = excluded.file_count,
      total_bytes = excluded.total_bytes,
      manifest = excluded.manifest
  `,
  ).run(
    backup.id,
    backup.clientId,
    timestamp,
    backup.fileCount,
    backup.totalBytes,
    manifestJson,
  );

  return {
    id: backup.id,
    clientId: backup.clientId,
    timestamp,
    fileCount: backup.fileCount,
    totalBytes: backup.totalBytes,
    manifest: backup.manifest,
  };
}

/**
 * List backups, optionally filtered by clientId.
 */
export function listBackups(clientId?: string): BackupRecord[] {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  let rows: any[];
  if (clientId) {
    rows = db
      .prepare(
        "SELECT * FROM backups WHERE client_id = ? ORDER BY timestamp DESC",
      )
      .all(clientId);
  } else {
    rows = db.prepare("SELECT * FROM backups ORDER BY timestamp DESC").all();
  }

  return rows.map((row) => ({
    id: `${row.id}`,
    clientId: `${row.client_id}`,
    timestamp: Number(row.timestamp),
    fileCount: Number(row.file_count),
    totalBytes: Number(row.total_bytes),
    manifest: row.manifest ? JSON.parse(row.manifest) : undefined,
  }));
}

/**
 * Delete a backup record by ID.
 */
export function deleteBackup(id: string, clientId?: string): boolean {
  if (!db) {
    throw new Error("Client store not opened. Call openClientStore() first.");
  }

  let result;
  if (clientId) {
    result = db
      .prepare("DELETE FROM backups WHERE id = ? AND client_id = ?")
      .run(id, clientId);
  } else {
    result = db.prepare("DELETE FROM backups WHERE id = ?").run(id);
  }

  return Number(result.changes) > 0;
}
