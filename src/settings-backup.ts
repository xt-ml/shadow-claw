import { CONFIG_KEYS } from "./config.js";
import { decryptValue, encryptValue } from "./crypto.js";
import { writeFileHandle } from "./storage/writeFileHandle.js";

export type ConfigEntryRecord = { key: string; value: unknown };
export type PasswordPathSegment = string | number;

export interface PlaintextPasswordEntry {
  key: string;
  path: PasswordPathSegment[];
  value: string;
}

export interface SettingsBackupPayload {
  kind: "shadowclaw-settings-backup";
  version: 1;
  exportedAt: number;
  includePlaintextPasswords: boolean;
  configEntries: ConfigEntryRecord[];
  plaintextPasswords?: PlaintextPasswordEntry[];
}

function cloneConfigValue(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

async function collectAndStripPasswordData(
  entries: ConfigEntryRecord[],
  includePlaintextPasswords: boolean,
): Promise<{
  configEntries: ConfigEntryRecord[];
  plaintextPasswords: PlaintextPasswordEntry[];
}> {
  const nextEntries: ConfigEntryRecord[] = [];
  const plaintextPasswords: PlaintextPasswordEntry[] = [];

  for (const entry of entries) {
    const key = entry.key;

    if (key === CONFIG_KEYS.STORAGE_HANDLE) {
      continue;
    }

    if (key === CONFIG_KEYS.GIT_PASSWORD) {
      if (includePlaintextPasswords && typeof entry.value === "string") {
        const decrypted = await decryptValue(entry.value);
        if (decrypted) {
          plaintextPasswords.push({ key, path: [], value: decrypted });
        }
      }

      continue;
    }

    const value = cloneConfigValue(entry.value);

    if (key === CONFIG_KEYS.GIT_ACCOUNTS && Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const account = value[i] as Record<string, unknown>;
        if (!account || typeof account !== "object") {
          continue;
        }

        const encryptedPassword = account.password;
        if (typeof encryptedPassword === "string" && encryptedPassword) {
          if (includePlaintextPasswords) {
            const decrypted = await decryptValue(encryptedPassword);
            if (decrypted) {
              plaintextPasswords.push({
                key,
                path: [i, "password"],
                value: decrypted,
              });
            }
          }

          delete account.password;
        }
      }
    }

    if (key === CONFIG_KEYS.INTEGRATION_CONNECTIONS && Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const record = value[i] as Record<string, unknown>;
        const credentialRef = record?.credentialRef as
          | Record<string, unknown>
          | undefined;

        const encryptedSecret = credentialRef?.encryptedSecret;
        if (typeof encryptedSecret === "string" && encryptedSecret) {
          if (includePlaintextPasswords) {
            const decrypted = await decryptValue(encryptedSecret);
            if (decrypted) {
              plaintextPasswords.push({
                key,
                path: [i, "credentialRef", "encryptedSecret"],
                value: decrypted,
              });
            }
          }

          delete credentialRef.encryptedSecret;
        }
      }
    }

    if (key === CONFIG_KEYS.REMOTE_MCP_CONNECTIONS && Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const record = value[i] as Record<string, unknown>;
        const credentialRef = record?.credentialRef as
          | Record<string, unknown>
          | undefined;

        const encryptedValue = credentialRef?.encryptedValue;
        if (typeof encryptedValue === "string" && encryptedValue) {
          if (includePlaintextPasswords) {
            const decrypted = await decryptValue(encryptedValue);
            if (decrypted) {
              plaintextPasswords.push({
                key,
                path: [i, "credentialRef", "encryptedValue"],
                value: decrypted,
              });
            }
          }

          delete credentialRef.encryptedValue;
        }
      }
    }

    nextEntries.push({ key, value });
  }

  return { configEntries: nextEntries, plaintextPasswords };
}

function applyPathValue(
  rootValue: unknown,
  path: PasswordPathSegment[],
  nextValue: string,
): unknown {
  if (path.length === 0) {
    return nextValue;
  }

  let current = rootValue as Record<string, unknown> | unknown[] | null;

  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    if (typeof segment === "number") {
      if (!Array.isArray(current) || !current[segment]) {
        return rootValue;
      }

      current = current[segment] as Record<string, unknown>;
    } else {
      if (!current || typeof current !== "object") {
        return rootValue;
      }

      const next = (current as Record<string, unknown>)[segment];
      if (!next || typeof next !== "object") {
        return rootValue;
      }

      current = next as Record<string, unknown>;
    }
  }

  const leaf = path[path.length - 1];
  if (typeof leaf === "number") {
    if (!Array.isArray(current)) {
      return rootValue;
    }

    current[leaf] = nextValue;
  } else {
    if (!current || typeof current !== "object") {
      return rootValue;
    }

    (current as Record<string, unknown>)[leaf] = nextValue;
  }

  return rootValue;
}

async function buildSettingsBackupPayload(
  entries: ConfigEntryRecord[],
  includePlaintextPasswords: boolean,
): Promise<SettingsBackupPayload> {
  const transformed = await collectAndStripPasswordData(
    entries,
    includePlaintextPasswords,
  );

  return {
    kind: "shadowclaw-settings-backup",
    version: 1,
    exportedAt: Date.now(),
    includePlaintextPasswords,
    configEntries: transformed.configEntries,
    plaintextPasswords: includePlaintextPasswords
      ? transformed.plaintextPasswords
      : undefined,
  };
}

export async function createSettingsBackupBlob(
  entries: ConfigEntryRecord[],
  includePlaintextPasswords: boolean,
): Promise<Blob> {
  const payload = await buildSettingsBackupPayload(
    entries,
    includePlaintextPasswords,
  );

  return new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
}

export async function writeSettingsBackupToFileHandle(
  fileHandle: FileSystemFileHandle,
  entries: ConfigEntryRecord[],
  includePlaintextPasswords: boolean,
): Promise<void> {
  const payload = await buildSettingsBackupPayload(
    entries,
    includePlaintextPasswords,
  );

  await writeFileHandle(fileHandle, JSON.stringify(payload, null, 2));
}

export async function reapplyPlaintextPasswords(
  configEntries: ConfigEntryRecord[],
  plaintextPasswords: PlaintextPasswordEntry[],
): Promise<ConfigEntryRecord[]> {
  if (!plaintextPasswords.length) {
    return configEntries;
  }

  const nextEntries = configEntries.map((entry) => ({
    key: entry.key,
    value: cloneConfigValue(entry.value),
  }));

  for (const secret of plaintextPasswords) {
    const encrypted = await encryptValue(secret.value);
    if (!encrypted) {
      continue;
    }

    const existingEntry = nextEntries.find((entry) => entry.key === secret.key);
    if (existingEntry) {
      existingEntry.value = applyPathValue(
        existingEntry.value,
        secret.path,
        encrypted,
      );
    } else if (secret.path.length === 0) {
      nextEntries.push({ key: secret.key, value: encrypted });
    }
  }

  return nextEntries;
}

export function parseSettingsBackupPayload(raw: string): SettingsBackupPayload {
  const parsed = JSON.parse(raw) as Partial<SettingsBackupPayload>;

  if (
    parsed?.kind !== "shadowclaw-settings-backup" ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.configEntries)
  ) {
    throw new Error("Invalid settings backup file");
  }

  const plaintextPasswords = Array.isArray(parsed.plaintextPasswords)
    ? parsed.plaintextPasswords.filter((entry) => {
        return (
          entry &&
          typeof entry.key === "string" &&
          Array.isArray(entry.path) &&
          typeof entry.value === "string"
        );
      })
    : [];

  return {
    kind: "shadowclaw-settings-backup",
    version: 1,
    exportedAt:
      typeof parsed.exportedAt === "number" ? parsed.exportedAt : Date.now(),
    includePlaintextPasswords: !!parsed.includePlaintextPasswords,
    configEntries: parsed.configEntries
      .filter((entry) => entry && typeof entry.key === "string")
      .map((entry) => ({ key: entry.key, value: entry.value })),
    plaintextPasswords,
  };
}
