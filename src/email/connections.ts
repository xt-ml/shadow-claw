import { CONFIG_KEYS, type AuthType, type ServiceType } from "../config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { ulid } from "../ulid.js";

import { getEmailPluginManifest } from "./catalog.js";

import type { ShadowClawDatabase } from "../types.js";

export interface EmailCredentialRef {
  serviceType: ServiceType;
  authType: AuthType;
  providerId?: string;
  accountId?: string;
  username?: string;
  headerName?: string;
  encryptedSecret?: string;
}

export interface EmailConnectionRecord {
  id: string;
  label: string;
  pluginId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  credentialRef: EmailCredentialRef | null;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertEmailConnectionInput {
  id?: string;
  label: string;
  pluginId: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

function normalizeCredentialRef(value: unknown): EmailCredentialRef | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as EmailCredentialRef;
  if (!candidate.serviceType || !candidate.authType) {
    return null;
  }

  return {
    serviceType: candidate.serviceType,
    authType: candidate.authType,
    providerId: candidate.providerId || undefined,
    accountId: candidate.accountId || undefined,
    username: candidate.username || undefined,
    headerName: candidate.headerName || undefined,
    encryptedSecret: candidate.encryptedSecret || undefined,
  };
}

function normalizeConnection(value: unknown): EmailConnectionRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<EmailConnectionRecord>;
  if (
    !candidate.id ||
    !candidate.label ||
    !candidate.pluginId ||
    typeof candidate.enabled !== "boolean" ||
    typeof candidate.createdAt !== "number" ||
    typeof candidate.updatedAt !== "number"
  ) {
    return null;
  }

  if (!getEmailPluginManifest(candidate.pluginId)) {
    return null;
  }

  return {
    id: candidate.id,
    label: candidate.label,
    pluginId: candidate.pluginId,
    enabled: candidate.enabled,
    config:
      candidate.config && typeof candidate.config === "object"
        ? { ...candidate.config }
        : {},
    credentialRef: normalizeCredentialRef(candidate.credentialRef),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

async function loadConnections(
  db: ShadowClawDatabase,
): Promise<EmailConnectionRecord[]> {
  const raw = await getConfig(db, CONFIG_KEYS.INTEGRATION_CONNECTIONS);
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: EmailConnectionRecord[] = [];
  for (const item of raw) {
    const record = normalizeConnection(item);
    if (record) {
      normalized.push(record);
    }
  }

  return normalized;
}

async function saveConnections(
  db: ShadowClawDatabase,
  records: EmailConnectionRecord[],
): Promise<void> {
  await setConfig(db, CONFIG_KEYS.INTEGRATION_CONNECTIONS, records);
}

export async function listEmailConnections(
  db: ShadowClawDatabase,
): Promise<EmailConnectionRecord[]> {
  return loadConnections(db);
}

export async function getEmailConnection(
  db: ShadowClawDatabase,
  id: string,
): Promise<EmailConnectionRecord | null> {
  if (!id) {
    return null;
  }

  const records = await loadConnections(db);

  return (
    records.find((record) => record.id === id) ||
    records.find((record) => record.label.toLowerCase() === id.toLowerCase()) ||
    null
  );
}

export async function upsertEmailConnection(
  db: ShadowClawDatabase,
  input: UpsertEmailConnectionInput,
): Promise<EmailConnectionRecord> {
  if (!input.label?.trim()) {
    throw new Error("Email connection label is required");
  }

  const plugin = getEmailPluginManifest(input.pluginId);
  if (!plugin) {
    throw new Error(`Unknown email plugin: ${input.pluginId}`);
  }

  const records = await loadConnections(db);
  const now = Date.now();

  if (input.id) {
    const idx = records.findIndex((record) => record.id === input.id);
    if (idx !== -1) {
      const existing = records[idx];
      const updated: EmailConnectionRecord = {
        ...existing,
        label: input.label.trim(),
        pluginId: plugin.id,
        enabled: input.enabled ?? existing.enabled,
        config: input.config ? { ...input.config } : existing.config,
        updatedAt: now,
      };
      records[idx] = updated;
      await saveConnections(db, records);

      return updated;
    }
  }

  const created: EmailConnectionRecord = {
    id: input.id || ulid(),
    label: input.label.trim(),
    pluginId: plugin.id,
    enabled: input.enabled ?? true,
    config: input.config ? { ...input.config } : {},
    credentialRef: null,
    createdAt: now,
    updatedAt: now,
  };
  records.push(created);
  await saveConnections(db, records);

  return created;
}

export async function bindEmailCredentialRef(
  db: ShadowClawDatabase,
  connectionId: string,
  credentialRef: EmailCredentialRef | null,
): Promise<EmailConnectionRecord | null> {
  if (!connectionId) {
    return null;
  }

  const records = await loadConnections(db);
  const idx = records.findIndex((record) => record.id === connectionId);
  if (idx === -1) {
    return null;
  }

  const current = records[idx];
  const updated: EmailConnectionRecord = {
    ...current,
    credentialRef: credentialRef ? normalizeCredentialRef(credentialRef) : null,
    updatedAt: Date.now(),
  };

  records[idx] = updated;
  await saveConnections(db, records);

  return updated;
}

export async function deleteEmailConnection(
  db: ShadowClawDatabase,
  id: string,
): Promise<boolean> {
  if (!id) {
    return false;
  }

  const records = await loadConnections(db);
  const next = records.filter((record) => record.id !== id);
  if (next.length === records.length) {
    return false;
  }

  await saveConnections(db, next);

  return true;
}
