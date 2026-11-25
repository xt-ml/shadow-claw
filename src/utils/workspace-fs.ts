import { getAppBasePath, getDeploymentNamespace } from "../core/app-routes.js";
import { basename, sanitizeFilename } from "./filename.js";

export { getAppBasePath, getDeploymentNamespace };

export const DEFAULT_GROUP_ID = "br:main";
export const DEFAULT_GROUP_NAME = "Main";
export const LEGACY_OPFS_ROOT = "shadowclaw";
export const LEGACY_DB_NAME = "shadowclaw";

export interface WorkspaceConversationInfo {
  groupId: string;
  name: string;
  createdAt?: number;
  isDefault: boolean;
}

export interface WorkspaceFileEntry {
  name: string;
  size: number;
  lastModified: number;
  [key: string]: any;
}

export interface WorkspaceFileReadResult extends WorkspaceFileEntry {
  buffer: ArrayBuffer;
  uint8Array: Uint8Array;
  text: string;
}

export interface WorkspaceFileSaveResult {
  ok: true;
  name: string;
  bytes: number;
  groupId: string;
  path: string;
  storageType: "memory" | "opfs";
}

export interface WorkspaceFsMockOptions {
  clearAll?: boolean;
  conversations?: Array<{
    groupId?: string;
    name?: string;
    createdAt?: number;
  }>;
  files?: Record<string, Record<string, string | Uint8Array | ArrayBuffer>>;
  forceMock?: boolean;
}

export interface WorkspaceFileOptions<
  TMeta extends Record<string, any> = Record<string, any>,
> {
  classify?: (filename: string) => TMeta;
}

export interface SaveWorkspaceFileOptions {
  eventName?: string;
}

const mockGroups = new Map<string, WorkspaceConversationInfo>([
  [
    DEFAULT_GROUP_ID,
    {
      groupId: DEFAULT_GROUP_ID,
      name: DEFAULT_GROUP_NAME,
      createdAt: 0,
      isDefault: true,
    },
  ],
]);

interface MockFileRecord {
  name: string;
  data: Uint8Array;
  size: number;
  lastModified: number;
}

const mockFiles = new Map<string, Map<string, MockFileRecord>>();
let forceMockStorage = false;

async function toUint8Array(content: unknown): Promise<Uint8Array> {
  if (typeof content === "string") {
    return new TextEncoder().encode(content);
  }
  if (content instanceof Uint8Array) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  if (typeof Blob !== "undefined" && content instanceof Blob) {
    return new Uint8Array(await content.arrayBuffer());
  }
  return new Uint8Array(0);
}

function toUint8ArraySync(content: unknown): Uint8Array {
  if (typeof content === "string") {
    return new TextEncoder().encode(content);
  }
  if (content instanceof Uint8Array) {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  return new Uint8Array(0);
}

export function setMockWorkspaceFsStorage(
  options: WorkspaceFsMockOptions = {},
): void {
  if (options.clearAll) {
    mockGroups.clear();
    mockFiles.clear();
    mockGroups.set(DEFAULT_GROUP_ID, {
      groupId: DEFAULT_GROUP_ID,
      name: DEFAULT_GROUP_NAME,
      createdAt: 0,
      isDefault: true,
    });
  }

  if (Array.isArray(options.conversations)) {
    for (const group of options.conversations) {
      const gid = group.groupId || DEFAULT_GROUP_ID;
      mockGroups.set(gid, {
        groupId: gid,
        name: group.name || gid,
        createdAt: group.createdAt || Date.now(),
        isDefault: gid === DEFAULT_GROUP_ID,
      });
    }
  }

  if (options.files && typeof options.files === "object") {
    for (const [gid, files] of Object.entries(options.files)) {
      const safeId = sanitizeGroupId(gid);
      if (!mockFiles.has(safeId)) {
        mockFiles.set(safeId, new Map());
      }
      const dirMap = mockFiles.get(safeId)!;
      for (const [fname, content] of Object.entries(files)) {
        const cleanName = sanitizeWorkspaceFilename(fname);
        const u8 = toUint8ArraySync(content);
        dirMap.set(cleanName, {
          name: cleanName,
          data: u8,
          size: u8.byteLength,
          lastModified: Date.now(),
        });
      }
    }
  }

  if (typeof options.forceMock === "boolean") {
    forceMockStorage = options.forceMock;
  }
}

export function resetMockWorkspaceFsStorage(): void {
  forceMockStorage = false;
  mockGroups.clear();
  mockFiles.clear();
  mockGroups.set(DEFAULT_GROUP_ID, {
    groupId: DEFAULT_GROUP_ID,
    name: DEFAULT_GROUP_NAME,
    createdAt: 0,
    isDefault: true,
  });
}

export function sanitizeGroupId(groupId: string): string {
  if (!groupId || typeof groupId !== "string" || !groupId.trim()) {
    return "br-main";
  }
  return groupId.trim().replace(/:/g, "-");
}

export function unsanitizeGroupId(safeId: string): string {
  if (!safeId || typeof safeId !== "string") {
    return DEFAULT_GROUP_ID;
  }
  if (safeId.startsWith("br-")) return `br:${safeId.slice(3)}`;
  if (safeId.startsWith("server-")) return `server:${safeId.slice(7)}`;
  if (safeId.startsWith("peer-")) return `peer:${safeId.slice(5)}`;
  if (safeId.startsWith("room-")) return `room:${safeId.slice(5)}`;
  return safeId;
}

export function sanitizeWorkspaceFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    throw new Error("A valid filename is required.");
  }
  const base = basename(filename, "");
  if (!base || base === "." || base === "..") {
    throw new Error(`Invalid filename: "${filename}"`);
  }
  return sanitizeFilename(base, { fallback: "_" }).replace(/\0/g, "_");
}

export function formatFileSize(bytes: number): string {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes <= 0) {
    return "0 B";
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getOpfsRootName(): string {
  const ns = getDeploymentNamespace();
  return ns ? `${LEGACY_OPFS_ROOT}-${ns}` : LEGACY_OPFS_ROOT;
}

export function getDbName(): string {
  const ns = getDeploymentNamespace();
  return ns ? `${LEGACY_DB_NAME}-${ns}` : LEGACY_DB_NAME;
}

export function isOpfsAvailable(): boolean {
  if (forceMockStorage) {
    return false;
  }
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.storage) &&
    typeof navigator.storage.getDirectory === "function"
  );
}

async function getOpfsGroupsDirectory(
  create = true,
): Promise<FileSystemDirectoryHandle | null> {
  if (!isOpfsAvailable()) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const primaryName = getOpfsRootName();
    let appDir: FileSystemDirectoryHandle | null = null;
    try {
      appDir = await root.getDirectoryHandle(primaryName, { create });
    } catch {
      if (primaryName !== LEGACY_OPFS_ROOT) {
        appDir = await root.getDirectoryHandle(LEGACY_OPFS_ROOT, { create });
      }
    }
    if (!appDir) {
      return null;
    }
    return await appDir.getDirectoryHandle("groups", { create });
  } catch {
    return null;
  }
}

async function queryIdbGroupMetadata(): Promise<
  Array<{ groupId?: string; name?: string; createdAt?: number }>
> {
  if (typeof indexedDB === "undefined") {
    return [];
  }

  const dbNamesToTry = [getDbName()];
  if (getDbName() !== LEGACY_DB_NAME) {
    dbNamesToTry.push(LEGACY_DB_NAME);
  }

  for (const dbName of dbNamesToTry) {
    try {
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      });

      if (!db) continue;
      if (!db.objectStoreNames.contains("config")) {
        db.close();
        continue;
      }

      const result = await new Promise<string | null>((resolve) => {
        try {
          const tx = db.transaction("config", "readonly");
          const store = tx.objectStore("config");
          const req = store.get("group_metadata");
          req.onsuccess = () => resolve(req.result?.value || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      db.close();
      if (result) {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }

  return [];
}

export async function getConversationDirHandle(
  groupId = DEFAULT_GROUP_ID,
  options: { create?: boolean } = {},
): Promise<FileSystemDirectoryHandle | null> {
  if (!isOpfsAvailable()) {
    return null;
  }
  const create = Boolean(options.create);
  const groupsDir = await getOpfsGroupsDirectory(create);
  if (!groupsDir) {
    return null;
  }
  try {
    return await groupsDir.getDirectoryHandle(sanitizeGroupId(groupId), {
      create,
    });
  } catch (err) {
    if (create) {
      throw err;
    }
    return null;
  }
}

export async function listConversations(): Promise<
  WorkspaceConversationInfo[]
> {
  const map = new Map<string, WorkspaceConversationInfo>();
  map.set(DEFAULT_GROUP_ID, {
    groupId: DEFAULT_GROUP_ID,
    name: DEFAULT_GROUP_NAME,
    createdAt: 0,
    isDefault: true,
  });

  try {
    const idbGroups = await queryIdbGroupMetadata();
    for (const g of idbGroups) {
      if (g && g.groupId) {
        map.set(g.groupId, {
          groupId: g.groupId,
          name:
            g.name ||
            (g.groupId === DEFAULT_GROUP_ID ? DEFAULT_GROUP_NAME : g.groupId),
          createdAt: g.createdAt || 0,
          isDefault: g.groupId === DEFAULT_GROUP_ID,
        });
      }
    }
  } catch {}

  if (isOpfsAvailable()) {
    try {
      const groupsDir = await getOpfsGroupsDirectory(false);
      if (groupsDir) {
        for await (const [safeName, handle] of (groupsDir as any).entries()) {
          if (handle.kind === "directory") {
            const gid = unsanitizeGroupId(safeName);
            if (!map.has(gid)) {
              const displayName =
                safeName === "br-main"
                  ? DEFAULT_GROUP_NAME
                  : safeName.startsWith("br-")
                    ? `Conversation (${safeName.slice(3, 11)})`
                    : safeName;
              map.set(gid, {
                groupId: gid,
                name: displayName,
                isDefault: gid === DEFAULT_GROUP_ID,
              });
            }
          }
        }
      }
    } catch {}
  }

  for (const [gid, g] of mockGroups.entries()) {
    if (!map.has(gid)) {
      map.set(gid, g);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.groupId === DEFAULT_GROUP_ID) return -1;
    if (b.groupId === DEFAULT_GROUP_ID) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function listWorkspaceFiles<
  TMeta extends Record<string, any> = Record<string, any>,
>(
  groupId = DEFAULT_GROUP_ID,
  options: WorkspaceFileOptions<TMeta> = {},
): Promise<WorkspaceFileEntry[]> {
  const safeId = sanitizeGroupId(groupId);
  const files: WorkspaceFileEntry[] = [];
  const classify = options.classify;

  if (!isOpfsAvailable()) {
    const dirMap = mockFiles.get(safeId);
    if (dirMap) {
      for (const item of dirMap.values()) {
        files.push({
          name: item.name,
          size: item.size,
          lastModified: item.lastModified || Date.now(),
          ...(classify ? classify(item.name) : {}),
        });
      }
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  try {
    const dirHandle = await getConversationDirHandle(groupId, {
      create: false,
    });
    if (!dirHandle) {
      return [];
    }
    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (handle.kind === "file") {
        try {
          const file = await handle.getFile();
          files.push({
            name,
            size: file.size,
            lastModified: file.lastModified,
            ...(classify ? classify(name) : {}),
          });
        } catch {}
      }
    }
  } catch {}

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readWorkspaceFile<
  TMeta extends Record<string, any> = Record<string, any>,
>(
  groupId = DEFAULT_GROUP_ID,
  filename: string,
  options: WorkspaceFileOptions<TMeta> = {},
): Promise<WorkspaceFileReadResult> {
  const cleanName = sanitizeWorkspaceFilename(filename);
  const safeId = sanitizeGroupId(groupId);
  const classify = options.classify;

  if (!isOpfsAvailable()) {
    const item = mockFiles.get(safeId)?.get(cleanName);
    if (!item) {
      throw new Error(`File "${cleanName}" not found in "${groupId}".`);
    }
    const uint8Array = item.data;
    const buffer = uint8Array.buffer.slice(
      uint8Array.byteOffset,
      uint8Array.byteOffset + uint8Array.byteLength,
    ) as ArrayBuffer;
    const text = new TextDecoder("utf-8").decode(uint8Array);
    return {
      name: cleanName,
      size: item.size,
      lastModified: item.lastModified,
      buffer,
      uint8Array,
      text,
      ...(classify ? classify(cleanName) : {}),
    };
  }

  const dirHandle = await getConversationDirHandle(groupId, { create: false });
  if (!dirHandle) {
    throw new Error(`Workspace directory "${safeId}" not found.`);
  }
  const fileHandle = await dirHandle.getFileHandle(cleanName, {
    create: false,
  });
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  const text = new TextDecoder("utf-8").decode(uint8Array);

  return {
    name: cleanName,
    size: file.size,
    lastModified: file.lastModified,
    buffer,
    uint8Array,
    text,
    ...(classify ? classify(cleanName) : {}),
  };
}

/**
 * Writes a file in OPFS via a dedicated Web Worker (Safari / WebKit main-thread fallback).
 */
export async function writeOpfsPathViaWorker(
  pathSegments: string[],
  content: unknown,
): Promise<{ ok: true }> {
  if (typeof (globalThis as any).Worker !== "function") {
    throw new Error(
      "Web Worker is not available for OPFS sync write fallback.",
    );
  }

  const u8 = await toUint8Array(content);

  return new Promise((resolve, reject) => {
    let blobUrl = "";
    let worker: Worker | null = null;

    const cleanup = () => {
      if (worker) {
        try {
          worker.terminate();
        } catch {}
        worker = null;
      }
      if (
        blobUrl &&
        typeof URL !== "undefined" &&
        typeof URL.revokeObjectURL === "function"
      ) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
        blobUrl = "";
      }
    };

    try {
      const src = [
        "self.onmessage = async (e) => {",
        "  try {",
        "    const { pathSegments, bytes } = e.data;",
        "    let dir = await navigator.storage.getDirectory();",
        "    for (let i = 0; i < pathSegments.length - 1; i++) {",
        "      dir = await dir.getDirectoryHandle(pathSegments[i], { create: true });",
        "    }",
        "    const filename = pathSegments[pathSegments.length - 1];",
        "    const fh = await dir.getFileHandle(filename, { create: true });",
        "    if (typeof fh.createWritable === 'function') {",
        "      const w = await fh.createWritable();",
        "      await w.write(bytes);",
        "      await w.close();",
        "    } else {",
        "      const h = await fh.createSyncAccessHandle();",
        "      try {",
        "        h.truncate(0);",
        "        h.write(bytes, { at: 0 });",
        "        if (typeof h.flush === 'function') h.flush();",
        "      } finally {",
        "        h.close();",
        "      }",
        "    }",
        "    self.postMessage({ ok: true });",
        "  } catch (err) {",
        "    self.postMessage({ error: (err && err.message) || String(err) });",
        "  }",
        "};",
      ].join("\n");

      const blob = new Blob([src], { type: "text/javascript" });
      blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);

      worker.onmessage = (e) => {
        cleanup();
        if (e.data && e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve({ ok: true });
        }
      };

      worker.onerror = (err) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      const transferBuf = u8.buffer.slice(
        u8.byteOffset,
        u8.byteOffset + u8.byteLength,
      );
      const transferBytes = new Uint8Array(transferBuf);
      worker.postMessage({ pathSegments, bytes: transferBytes }, [transferBuf]);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

export async function saveWorkspaceFile(
  groupId = DEFAULT_GROUP_ID,
  filename: string,
  content: unknown,
  options: SaveWorkspaceFileOptions = {},
): Promise<WorkspaceFileSaveResult> {
  const cleanName = sanitizeWorkspaceFilename(filename);
  const safeId = sanitizeGroupId(groupId);
  const u8 = await toUint8Array(content);

  if (!isOpfsAvailable()) {
    if (!mockFiles.has(safeId)) {
      mockFiles.set(safeId, new Map());
    }
    mockFiles.get(safeId)!.set(cleanName, {
      name: cleanName,
      data: u8,
      size: u8.byteLength,
      lastModified: Date.now(),
    });
    return {
      ok: true,
      name: cleanName,
      bytes: u8.byteLength,
      groupId,
      path: `groups/${safeId}/${cleanName}`,
      storageType: "memory",
    };
  }

  const dirHandle = await getConversationDirHandle(groupId, { create: true });
  if (!dirHandle) {
    throw new Error(`Unable to open OPFS directory for "${groupId}".`);
  }

  const fileHandle = (await dirHandle.getFileHandle(cleanName, {
    create: true,
  })) as any;

  let writeSucceeded = false;
  let writeError: unknown = null;

  try {
    if (typeof fileHandle.createWritable === "function") {
      const writable = await fileHandle.createWritable();
      await writable.write(u8);
      await writable.close();
      writeSucceeded = true;
    } else if (typeof fileHandle.createSyncAccessHandle === "function") {
      const sync = await fileHandle.createSyncAccessHandle();
      try {
        sync.truncate(0);
        sync.write(u8, { at: 0 });
        if (typeof sync.flush === "function") {
          sync.flush();
        }
      } finally {
        sync.close();
      }
      writeSucceeded = true;
    }
  } catch (err) {
    writeError = err;
  }

  if (!writeSucceeded) {
    try {
      await writeOpfsPathViaWorker(
        [getOpfsRootName(), "groups", safeId, cleanName],
        u8,
      );
      writeSucceeded = true;
    } catch (workerErr) {
      throw writeError || workerErr;
    }
  }

  if (
    options.eventName &&
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(options.eventName, {
          detail: {
            groupId,
            filename: cleanName,
            path: `groups/${safeId}/${cleanName}`,
          },
        }),
      );
    } catch {}
  }

  return {
    ok: true,
    name: cleanName,
    bytes: u8.byteLength,
    groupId,
    path: `groups/${safeId}/${cleanName}`,
    storageType: "opfs",
  };
}

export async function deleteWorkspaceFile(
  groupId = DEFAULT_GROUP_ID,
  filename: string,
): Promise<{ ok: true; name: string; groupId: string }> {
  const cleanName = sanitizeWorkspaceFilename(filename);
  const safeId = sanitizeGroupId(groupId);

  if (!isOpfsAvailable()) {
    mockFiles.get(safeId)?.delete(cleanName);
    return { ok: true, name: cleanName, groupId };
  }

  const dirHandle = await getConversationDirHandle(groupId, { create: false });
  if (dirHandle) {
    await dirHandle.removeEntry(cleanName);
  }
  return { ok: true, name: cleanName, groupId };
}
