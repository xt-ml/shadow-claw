import { CONFIG_KEYS } from "./config.js";
import { getConfig } from "./db/getConfig.js";
import { setConfig } from "./db/setConfig.js";
import { ulid } from "./ulid.js";

import type { ShadowClawDatabase } from "./types.js";
import type { AuthType, ServiceType } from "./config.js";

export type RemoteMcpTransport = "streamable_http" | "sse" | "websocket";

export interface RemoteMcpCredentialRef {
  serviceType: ServiceType;
  authType: AuthType;
  providerId?: string;
  accountId?: string;
  gitAccountId?: string;
  headerName?: string;
  encryptedValue?: string;
}

export interface RemoteMcpConnectionRecord {
  id: string;
  label: string;
  serviceType: Extract<ServiceType, "mcp_remote" | "webmcp_local">;
  serverUrl: string;
  transport: RemoteMcpTransport;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  credentialRef: RemoteMcpCredentialRef | null;
}

export interface UpsertRemoteMcpConnectionInput {
  id?: string;
  label: string;
  serviceType?: Extract<ServiceType, "mcp_remote" | "webmcp_local">;
  serverUrl: string;
  transport: RemoteMcpTransport;
  enabled?: boolean;
}

function isSafeAbsoluteUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);

    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeCredentialRef(
  value: unknown,
  connectionServiceType: RemoteMcpConnectionRecord["serviceType"],
): RemoteMcpCredentialRef | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as RemoteMcpCredentialRef;
  if (!raw.serviceType || !raw.authType) {
    return null;
  }

  if (raw.serviceType !== connectionServiceType) {
    throw new Error(
      "Credential ref serviceType must match connection serviceType",
    );
  }

  return {
    serviceType: raw.serviceType,
    authType: raw.authType,
    providerId: raw.providerId || undefined,
    accountId: raw.accountId || undefined,
    gitAccountId: raw.gitAccountId || undefined,
    headerName: raw.headerName || undefined,
    encryptedValue: raw.encryptedValue || undefined,
  };
}

function normalizeConnection(value: unknown): RemoteMcpConnectionRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<RemoteMcpConnectionRecord>;
  if (
    !raw.id ||
    !raw.label ||
    !raw.serviceType ||
    !raw.transport ||
    typeof raw.enabled !== "boolean" ||
    typeof raw.createdAt !== "number" ||
    typeof raw.updatedAt !== "number" ||
    !isSafeAbsoluteUrl(raw.serverUrl)
  ) {
    return null;
  }

  if (raw.serviceType !== "mcp_remote" && raw.serviceType !== "webmcp_local") {
    return null;
  }

  if (
    raw.transport !== "streamable_http" &&
    raw.transport !== "sse" &&
    raw.transport !== "websocket"
  ) {
    return null;
  }

  return {
    id: raw.id,
    label: raw.label,
    serviceType: raw.serviceType,
    serverUrl: raw.serverUrl,
    transport: raw.transport,
    enabled: raw.enabled,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    credentialRef: normalizeCredentialRef(raw.credentialRef, raw.serviceType),
  };
}

async function loadConnections(
  db: ShadowClawDatabase,
): Promise<RemoteMcpConnectionRecord[]> {
  const raw = await getConfig(db, CONFIG_KEYS.REMOTE_MCP_CONNECTIONS);
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: RemoteMcpConnectionRecord[] = [];
  for (const item of raw) {
    const parsed = normalizeConnection(item);
    if (parsed) {
      normalized.push(parsed);
    }
  }

  return normalized;
}

async function saveConnections(
  db: ShadowClawDatabase,
  connections: RemoteMcpConnectionRecord[],
): Promise<void> {
  await setConfig(db, CONFIG_KEYS.REMOTE_MCP_CONNECTIONS, connections);
}

export async function listRemoteMcpConnections(
  db: ShadowClawDatabase,
): Promise<RemoteMcpConnectionRecord[]> {
  return loadConnections(db);
}

export async function getRemoteMcpConnection(
  db: ShadowClawDatabase,
  id: string,
): Promise<RemoteMcpConnectionRecord | null> {
  if (!id) {
    return null;
  }

  const all = await loadConnections(db);

  // Match by exact ID first, then fall back to case-insensitive label match
  // so agents can reference connections by human-readable name.

  return (
    all.find((connection) => connection.id === id) ||
    all.find(
      (connection) => connection.label.toLowerCase() === id.toLowerCase(),
    ) ||
    null
  );
}

export async function upsertRemoteMcpConnection(
  db: ShadowClawDatabase,
  input: UpsertRemoteMcpConnectionInput,
): Promise<RemoteMcpConnectionRecord> {
  if (!input?.label?.trim()) {
    throw new Error("Connection label is required");
  }

  if (!isSafeAbsoluteUrl(input.serverUrl)) {
    throw new Error("Connection serverUrl must be an absolute http(s) URL");
  }

  const serviceType = (input.serviceType ||
    "mcp_remote") as RemoteMcpConnectionRecord["serviceType"];
  if (serviceType !== "mcp_remote" && serviceType !== "webmcp_local") {
    throw new Error("Unsupported serviceType for remote MCP connection");
  }

  const all = await loadConnections(db);
  const now = Date.now();

  if (input.id) {
    const existingIndex = all.findIndex((record) => record.id === input.id);
    if (existingIndex !== -1) {
      const existing = all[existingIndex];
      const updated: RemoteMcpConnectionRecord = {
        ...existing,
        label: input.label.trim(),
        serviceType,
        serverUrl: input.serverUrl,
        transport: input.transport,
        enabled: input.enabled ?? existing.enabled,
        updatedAt: now,
      };
      all[existingIndex] = updated;
      await saveConnections(db, all);

      return updated;
    }
  }

  const created: RemoteMcpConnectionRecord = {
    id: input.id || ulid(),
    label: input.label.trim(),
    serviceType,
    serverUrl: input.serverUrl,
    transport: input.transport,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
    credentialRef: null,
  };

  all.push(created);
  await saveConnections(db, all);

  return created;
}

export async function bindRemoteMcpCredentialRef(
  db: ShadowClawDatabase,
  connectionId: string,
  credentialRef: RemoteMcpCredentialRef | null,
): Promise<RemoteMcpConnectionRecord | null> {
  if (!connectionId) {
    return null;
  }

  const all = await loadConnections(db);
  const idx = all.findIndex((record) => record.id === connectionId);
  if (idx === -1) {
    return null;
  }

  const current = all[idx];
  const normalizedRef = credentialRef
    ? normalizeCredentialRef(credentialRef, current.serviceType)
    : null;

  const updated: RemoteMcpConnectionRecord = {
    ...current,
    credentialRef: normalizedRef,
    updatedAt: Date.now(),
  };

  all[idx] = updated;
  await saveConnections(db, all);

  return updated;
}

export async function deleteRemoteMcpConnection(
  db: ShadowClawDatabase,
  id: string,
): Promise<boolean> {
  if (!id) {
    return false;
  }

  const all = await loadConnections(db);
  const next = all.filter((record) => record.id !== id);
  if (next.length === all.length) {
    return false;
  }

  await saveConnections(db, next);

  return true;
}
