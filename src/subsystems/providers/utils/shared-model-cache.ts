import { CONFIG_KEYS } from "../../../config/config.js";
import { getDeploymentNamespace } from "../../../core/app-routes.js";
import { getConfig } from "../../../db/get-config.js";
import { setConfig } from "../../../db/set-config.js";
import type { ShadowClawDatabase } from "../../../db/types.js";
import {
  isLocalOrPrivateHost,
  isLoopbackHost,
} from "../../../utils/network.js";
import { isTruthyConfigValue } from "../../../utils/parse-boolean-config.js";
import { assembleChunkedStream } from "./assemble-chunked-stream.js";
import { isCacheStorageAvailable } from "./is-cache-storage-available.js";
import { readPartialMeta } from "./read-partial-meta.js";
import {
  DEFAULT_MODEL_CACHE_NAME,
  type SharedModelCacheConfig,
  type SharedModelCacheScope,
} from "./types.js";

export const LEGACY_TRANSFORMERS_CACHE_NAME = "transformers-cache";

const DEFAULT_SHARED_CONFIG: SharedModelCacheConfig = {
  scope: "origin",
  mirrorEnabled: false,
  mirrorUrl: "",
  dirHandle: null,
};

const CONFIG_CACHE_TTL_MS = 5_000;
const HUGGINGFACE_HOSTS = new Set(["huggingface.co", "hf-mirror.com"]);

let overrideConfig: Partial<SharedModelCacheConfig> | null = null;
let cachedConfig: SharedModelCacheConfig | null = null;
let cachedConfigAt = 0;

export function resetSharedModelCacheConfigCache(): void {
  cachedConfig = null;
  cachedConfigAt = 0;
}

export function setSharedModelCacheConfigOverride(
  cfg: Partial<SharedModelCacheConfig> | null,
): void {
  overrideConfig = cfg;
  resetSharedModelCacheConfigCache();
}

export function resolveModelCacheName(
  baseCacheName: string = DEFAULT_MODEL_CACHE_NAME,
  scope: SharedModelCacheScope = "origin",
): string {
  if (scope === "deployment") {
    const ns = getDeploymentNamespace();
    if (ns && !baseCacheName.endsWith(`-${ns}`)) {
      return `${baseCacheName}-${ns}`;
    }
  }
  return baseCacheName;
}

export function getFallbackModelCacheNames(
  baseCacheName: string = DEFAULT_MODEL_CACHE_NAME,
  scope: SharedModelCacheScope = "origin",
): string[] {
  const primary = resolveModelCacheName(baseCacheName, scope);
  const altScope: SharedModelCacheScope =
    scope === "origin" ? "deployment" : "origin";
  const alternate = resolveModelCacheName(baseCacheName, altScope);
  return alternate && alternate !== primary ? [alternate] : [];
}

export function normalizeSharedModelMirrorUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") {
    return "";
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function resolveMirrorModelUrl(
  originalUrl: string,
  mirrorBaseUrl: string,
): string | null {
  const normalizedBase = normalizeSharedModelMirrorUrl(mirrorBaseUrl);
  if (!normalizedBase || !originalUrl || typeof originalUrl !== "string") {
    return null;
  }

  if (
    originalUrl.includes("\0") ||
    originalUrl.includes("..") ||
    originalUrl.includes("\\")
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (!HUGGINGFACE_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }

  const cleanPath = parsed.pathname.startsWith("/")
    ? parsed.pathname
    : `/${parsed.pathname}`;
  return `${normalizedBase}${cleanPath}${parsed.search}`;
}

export function buildModelFetchInit(
  url: string,
  baseInit?: RequestInit,
): RequestInit {
  const init: Record<string, any> = { ...(baseInit || {}) };
  try {
    const host = new URL(url).hostname;
    if (isLoopbackHost(host)) {
      init.targetAddressSpace = "loopback";
    } else if (isLocalOrPrivateHost(host)) {
      init.targetAddressSpace = "private";
    }
  } catch {}
  return init;
}

export function modelUrlToCacheSegments(url: string): string[] {
  try {
    const parsed = new URL(url);
    const rawParts = parsed.pathname
      .split("/")
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      })
      .filter((s) => s && s !== "." && s !== "..")
      .map((s) => s.replace(/[\0<>:"|?*\\]/g, "_"));

    if (
      HUGGINGFACE_HOSTS.has(parsed.hostname.toLowerCase()) &&
      rawParts.length >= 5 &&
      rawParts[2] === "resolve"
    ) {
      return ["hf", ...rawParts];
    }

    const safeHost = parsed.hostname.replace(/[^a-zA-Z0-9._-]/g, "_");
    return ["url", safeHost, ...rawParts];
  } catch {
    return ["url", "unknown", "model.bin"];
  }
}

async function readIndexedDbSharedConfig(): Promise<
  Partial<SharedModelCacheConfig>
> {
  if (
    typeof indexedDB === "undefined" ||
    typeof indexedDB.open !== "function"
  ) {
    return {};
  }

  return await new Promise((resolve) => {
    try {
      const ns = getDeploymentNamespace();
      const dbName = ns ? `shadowclaw-${ns}` : "shadowclaw";
      const req = indexedDB.open(dbName);
      req.onerror = () => resolve({});
      req.onsuccess = () => {
        const idb = req.result;
        if (!idb.objectStoreNames?.contains?.("config")) {
          idb.close?.();
          resolve({});
          return;
        }
        try {
          const tx = idb.transaction(["config"], "readonly");
          const store = tx.objectStore("config");
          const keys = [
            CONFIG_KEYS.SHARED_MODEL_CACHE_SCOPE,
            CONFIG_KEYS.SHARED_MODEL_CACHE_MIRROR_ENABLED,
            CONFIG_KEYS.SHARED_MODEL_CACHE_URL,
            CONFIG_KEYS.SHARED_MODEL_CACHE_DIR_HANDLE,
          ] as const;

          const found: Record<string, any> = {};
          let remaining = keys.length;
          for (const key of keys) {
            const getReq = store.get(key);
            getReq.onsuccess = () => {
              found[key] = getReq.result?.value;
              remaining -= 1;
              if (remaining === 0) {
                idb.close?.();
                resolve({
                  scope:
                    found[CONFIG_KEYS.SHARED_MODEL_CACHE_SCOPE] === "deployment"
                      ? "deployment"
                      : "origin",
                  mirrorEnabled: isTruthyConfigValue(
                    found[CONFIG_KEYS.SHARED_MODEL_CACHE_MIRROR_ENABLED],
                    false,
                  ),
                  mirrorUrl: normalizeSharedModelMirrorUrl(
                    found[CONFIG_KEYS.SHARED_MODEL_CACHE_URL],
                  ),
                  dirHandle:
                    found[CONFIG_KEYS.SHARED_MODEL_CACHE_DIR_HANDLE] || null,
                });
              }
            };
            getReq.onerror = () => {
              remaining -= 1;
              if (remaining === 0) {
                idb.close?.();
                resolve({});
              }
            };
          }
        } catch {
          idb.close?.();
          resolve({});
        }
      };
    } catch {
      resolve({});
    }
  });
}

export async function loadSharedModelCacheConfig(): Promise<SharedModelCacheConfig> {
  if (overrideConfig) {
    return {
      ...DEFAULT_SHARED_CONFIG,
      ...overrideConfig,
      scope: overrideConfig.scope === "deployment" ? "deployment" : "origin",
      mirrorEnabled: Boolean(overrideConfig.mirrorEnabled),
      mirrorUrl: normalizeSharedModelMirrorUrl(overrideConfig.mirrorUrl || ""),
      dirHandle: overrideConfig.dirHandle ?? null,
    };
  }

  const now = Date.now();
  if (cachedConfig && now - cachedConfigAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }

  const idbCfg = await readIndexedDbSharedConfig().catch(() => ({}));
  cachedConfig = {
    ...DEFAULT_SHARED_CONFIG,
    ...idbCfg,
    scope:
      (idbCfg as Partial<SharedModelCacheConfig>).scope === "deployment"
        ? "deployment"
        : "origin",
    mirrorEnabled: Boolean(
      (idbCfg as Partial<SharedModelCacheConfig>).mirrorEnabled,
    ),
    mirrorUrl: normalizeSharedModelMirrorUrl(
      (idbCfg as Partial<SharedModelCacheConfig>).mirrorUrl || "",
    ),
    dirHandle: (idbCfg as Partial<SharedModelCacheConfig>).dirHandle ?? null,
  };
  cachedConfigAt = now;
  return cachedConfig;
}

async function hasDirPermission(
  dirHandle: any,
  mode: "read" | "readwrite",
): Promise<boolean> {
  if (!dirHandle || typeof dirHandle.getDirectoryHandle !== "function") {
    return false;
  }
  if (typeof dirHandle.queryPermission !== "function") {
    return true;
  }
  try {
    return (await dirHandle.queryPermission({ mode })) === "granted";
  } catch {
    return false;
  }
}

export async function readModelFromSharedDir(
  dirHandle: any,
  url: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  if (!(await hasDirPermission(dirHandle, "read"))) {
    return null;
  }

  const segments = modelUrlToCacheSegments(url);
  if (segments.length === 0) {
    return null;
  }

  try {
    let dir = dirHandle;
    for (let i = 0; i < segments.length - 1; i++) {
      dir = await dir.getDirectoryHandle(segments[i], { create: false });
    }
    const fileHandle = await dir.getFileHandle(segments[segments.length - 1], {
      create: false,
    });
    const file = await fileHandle.getFile();
    const size = Number(file.size) || 0;

    let stream: ReadableStream<Uint8Array>;
    if (typeof file.stream === "function") {
      stream = file.stream();
    } else {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
    }

    return { stream, size };
  } catch {
    return null;
  }
}

export async function writeModelToSharedDir(
  dirHandle: any,
  url: string,
  data: Uint8Array | ReadableStream<Uint8Array>,
): Promise<boolean> {
  if (!(await hasDirPermission(dirHandle, "readwrite"))) {
    return false;
  }

  const segments = modelUrlToCacheSegments(url);
  if (segments.length === 0) {
    return false;
  }

  try {
    let dir = dirHandle;
    for (let i = 0; i < segments.length - 1; i++) {
      dir = await dir.getDirectoryHandle(segments[i], { create: true });
    }
    const fileHandle = await dir.getFileHandle(segments[segments.length - 1], {
      create: true,
    });
    const writable = await fileHandle.createWritable();

    if (data instanceof Uint8Array) {
      await writable.write(data);
    } else if (data && typeof data.getReader === "function") {
      const reader = data.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await writable.write(value);
        }
      }
    }

    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function selectSharedModelCacheDirectory(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const pickerMaybe = Reflect.get(globalThis, "showDirectoryPicker");
  const picker =
    typeof pickerMaybe === "function" ? pickerMaybe.bind(globalThis) : null;

  if (!picker) {
    throw new Error(
      "Local folder picker is unavailable in this browser/context.",
    );
  }

  try {
    const handle = await picker({
      mode: "readwrite",
      id: "shadowclaw-shared-models",
    });
    await setConfig(db, CONFIG_KEYS.SHARED_MODEL_CACHE_DIR_HANDLE, handle);
    resetSharedModelCacheConfigCache();
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return false;
    }
    throw err;
  }
}

export async function resetSharedModelCacheDirectory(
  db: ShadowClawDatabase,
): Promise<void> {
  await setConfig(db, CONFIG_KEYS.SHARED_MODEL_CACHE_DIR_HANDLE, null as any);
  resetSharedModelCacheConfigCache();
}

export async function getSharedModelDirStatus(db: ShadowClawDatabase): Promise<{
  connected: boolean;
  permission: "granted" | "prompt" | "denied" | "unavailable";
  name?: string;
}> {
  const handle: any = await getConfig(
    db,
    CONFIG_KEYS.SHARED_MODEL_CACHE_DIR_HANDLE,
  );
  if (!handle) {
    return { connected: false, permission: "unavailable" };
  }

  let permission: "granted" | "prompt" | "denied" | "unavailable" = "granted";
  if (typeof handle.queryPermission === "function") {
    try {
      permission = await handle.queryPermission({ mode: "readwrite" });
    } catch {
      permission = "prompt";
    }
  }

  return {
    connected: true,
    permission,
    name: typeof handle.name === "string" ? handle.name : undefined,
  };
}

export async function getBrowserModelCacheStats(
  scope: SharedModelCacheScope = "origin",
): Promise<{
  cacheNames: string[];
  entryCount: number;
  totalBytes: number;
}> {
  const cacheNames = Array.from(
    new Set([
      resolveModelCacheName(DEFAULT_MODEL_CACHE_NAME, scope),
      resolveModelCacheName("shadow-claw-litertlm-models", scope),
    ]),
  );

  if (!isCacheStorageAvailable()) {
    return { cacheNames, entryCount: 0, totalBytes: 0 };
  }

  let entryCount = 0;
  let totalBytes = 0;

  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      entryCount += keys.length;
      for (const req of keys) {
        const resp = await cache.match(req);
        if (!resp) continue;
        const cl = resp.headers?.get?.("content-length");
        if (cl && Number.isFinite(Number(cl))) {
          totalBytes += Number(cl);
        } else if (typeof resp.arrayBuffer === "function") {
          try {
            const ab = await resp.arrayBuffer();
            totalBytes += ab.byteLength;
          } catch {}
        }
      }
    } catch {}
  }

  return { cacheNames, entryCount, totalBytes };
}

export async function clearBrowserModelCaches(
  scope: SharedModelCacheScope = "origin",
): Promise<void> {
  if (!isCacheStorageAvailable()) {
    return;
  }

  const names = Array.from(
    new Set([
      resolveModelCacheName(DEFAULT_MODEL_CACHE_NAME, scope),
      resolveModelCacheName("shadow-claw-litertlm-models", scope),
      DEFAULT_MODEL_CACHE_NAME,
      "shadow-claw-litertlm-models",
    ]),
  );

  for (const name of names) {
    try {
      await caches.delete(name);
    } catch {}
  }
}

export async function hasModelInSharedDir(
  dirHandle: any,
  url: string,
): Promise<boolean> {
  if (!(await hasDirPermission(dirHandle, "read"))) {
    return false;
  }

  const segments = modelUrlToCacheSegments(url);
  if (segments.length === 0) {
    return false;
  }

  try {
    let dir = dirHandle;
    for (let i = 0; i < segments.length - 1; i++) {
      dir = await dir.getDirectoryHandle(segments[i], { create: false });
    }
    const fileHandle = await dir.getFileHandle(segments[segments.length - 1], {
      create: false,
    });
    const file = await fileHandle.getFile();
    return (Number(file.size) || 0) > 0;
  } catch {
    return false;
  }
}

function responseToUint8ArrayStream(resp: any): {
  stream: ReadableStream<Uint8Array>;
  size: number;
} | null {
  const cl = Number(resp?.headers?.get?.("content-length") || 0) || 0;
  if (resp?.body && typeof resp.body.getReader === "function") {
    return { stream: resp.body, size: cl };
  }
  if (typeof resp?.arrayBuffer === "function") {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const ab = await resp.arrayBuffer();
          controller.enqueue(new Uint8Array(ab));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return { stream, size: cl };
  }
  return null;
}

export async function findLegacyTransformersCacheEntry(
  url: string,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  if (!isCacheStorageAvailable()) {
    return null;
  }

  try {
    const cache = await caches.open(LEGACY_TRANSFORMERS_CACHE_NAME);
    const resp = await cache.match(url);
    if (!resp) {
      return null;
    }
    return responseToUint8ArrayStream(resp);
  } catch {
    return null;
  }
}

export async function readFallbackBrowserModel(
  url: string,
  baseCacheName: string = DEFAULT_MODEL_CACHE_NAME,
  scope: SharedModelCacheScope = "origin",
): Promise<{
  stream: ReadableStream<Uint8Array>;
  received: number;
  total: number | null;
} | null> {
  for (const fallbackCacheName of getFallbackModelCacheNames(
    baseCacheName,
    scope,
  )) {
    try {
      const meta = await readPartialMeta(url, fallbackCacheName);
      if (meta?.complete) {
        return {
          stream: assembleChunkedStream(url, meta, fallbackCacheName),
          received: meta.received,
          total: meta.total ?? meta.received,
        };
      }
    } catch {}
  }

  const legacyHit = await findLegacyTransformersCacheEntry(url);
  if (legacyHit) {
    return {
      stream: legacyHit.stream,
      received: legacyHit.size,
      total: legacyHit.size > 0 ? legacyHit.size : null,
    };
  }

  return null;
}

export async function maybeBackfillSharedDir(
  dirHandle: any,
  url: string,
  stream: ReadableStream<Uint8Array>,
): Promise<ReadableStream<Uint8Array>> {
  if (!dirHandle || typeof stream.tee !== "function") {
    return stream;
  }
  if (await hasModelInSharedDir(dirHandle, url)) {
    return stream;
  }
  const [consumerStream, writeStream] = stream.tee();
  void writeModelToSharedDir(dirHandle, url, writeStream).catch(() => {});
  return consumerStream;
}

export async function migrateBrowserModelCache(
  fromScope: SharedModelCacheScope,
  toScope: SharedModelCacheScope,
  options?: { deleteSource?: boolean },
): Promise<{
  migratedEntries: number;
  skippedEntries: number;
  migratedCaches: string[];
}> {
  if (!isCacheStorageAvailable() || fromScope === toScope) {
    return { migratedEntries: 0, skippedEntries: 0, migratedCaches: [] };
  }

  const baseNames = [DEFAULT_MODEL_CACHE_NAME, "shadow-claw-litertlm-models"];
  let migratedEntries = 0;
  let skippedEntries = 0;
  const migratedCaches: string[] = [];

  for (const baseName of baseNames) {
    const srcName = resolveModelCacheName(baseName, fromScope);
    const dstName = resolveModelCacheName(baseName, toScope);
    if (srcName === dstName) {
      continue;
    }

    try {
      const srcCache = await caches.open(srcName);
      const keys = await srcCache.keys();
      if (keys.length === 0) {
        continue;
      }
      const dstCache = await caches.open(dstName);
      let cacheTouched = false;

      for (const req of keys) {
        const reqUrl = typeof req === "string" ? req : req.url;
        const existing = await dstCache.match(reqUrl);
        if (existing) {
          skippedEntries += 1;
          continue;
        }
        const resp = await srcCache.match(reqUrl);
        if (!resp) {
          continue;
        }
        const ab =
          typeof (resp as any).arrayBuffer === "function"
            ? await (resp as any).arrayBuffer()
            : new Uint8Array(0).buffer;
        const headers = new Headers(resp.headers || {});
        const toStore: any =
          typeof Response === "function"
            ? new Response(ab, { status: 200, headers })
            : { headers, arrayBuffer: async () => ab };
        if (typeof toStore.arrayBuffer !== "function") {
          toStore.arrayBuffer = async () => ab;
        }
        await dstCache.put(reqUrl, toStore);
        migratedEntries += 1;
        cacheTouched = true;
      }

      if (cacheTouched) {
        migratedCaches.push(dstName);
      }

      if (options?.deleteSource && fromScope === "deployment") {
        await caches.delete(srcName);
      }
    } catch {}
  }

  return { migratedEntries, skippedEntries, migratedCaches };
}

export async function exportBrowserModelsToSharedDir(
  dirHandle: any,
  scope: SharedModelCacheScope = "origin",
): Promise<{
  exportedFiles: number;
  skippedFiles: number;
  totalBytes: number;
}> {
  if (
    !isCacheStorageAvailable() ||
    !(await hasDirPermission(dirHandle, "readwrite"))
  ) {
    return { exportedFiles: 0, skippedFiles: 0, totalBytes: 0 };
  }

  const baseNames = [DEFAULT_MODEL_CACHE_NAME, "shadow-claw-litertlm-models"];
  const cacheCandidates = Array.from(
    new Set(
      baseNames.flatMap((base) => [
        resolveModelCacheName(base, scope),
        ...getFallbackModelCacheNames(base, scope),
      ]),
    ),
  );

  const seenUrls = new Set<string>();
  let exportedFiles = 0;
  let skippedFiles = 0;
  let totalBytes = 0;

  for (const cacheName of cacheCandidates) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      for (const req of keys) {
        const keyUrl = typeof req === "string" ? req : req.url;
        if (!keyUrl.endsWith("?__sc_meta=1")) {
          continue;
        }
        const modelUrl = keyUrl.slice(0, -"?__sc_meta=1".length);
        if (seenUrls.has(modelUrl)) {
          continue;
        }
        seenUrls.add(modelUrl);

        const meta = await readPartialMeta(modelUrl, cacheName);
        if (!meta?.complete) {
          continue;
        }

        if (await hasModelInSharedDir(dirHandle, modelUrl)) {
          skippedFiles += 1;
          continue;
        }

        const stream = assembleChunkedStream(modelUrl, meta, cacheName);
        const wrote = await writeModelToSharedDir(dirHandle, modelUrl, stream);
        if (wrote) {
          exportedFiles += 1;
          totalBytes += Number(meta.received) || 0;
        }
      }
    } catch {}
  }

  try {
    const legacyCache = await caches.open(LEGACY_TRANSFORMERS_CACHE_NAME);
    const keys = await legacyCache.keys();
    for (const req of keys) {
      const modelUrl = typeof req === "string" ? req : req.url;
      if (
        !modelUrl ||
        modelUrl.includes("__sc_meta=") ||
        modelUrl.includes("__sc_chunk=") ||
        seenUrls.has(modelUrl)
      ) {
        continue;
      }
      seenUrls.add(modelUrl);

      if (await hasModelInSharedDir(dirHandle, modelUrl)) {
        skippedFiles += 1;
        continue;
      }

      const resp = await legacyCache.match(modelUrl);
      if (!resp) {
        continue;
      }

      let bytes: Uint8Array;
      if (typeof (resp as any).arrayBuffer === "function") {
        bytes = new Uint8Array(await (resp as any).arrayBuffer());
      } else if (resp.body && typeof resp.body.getReader === "function") {
        const reader = resp.body.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const total = chunks.reduce((s, c) => s + c.byteLength, 0);
        bytes = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) {
          bytes.set(c, off);
          off += c.byteLength;
        }
      } else {
        continue;
      }

      if (await writeModelToSharedDir(dirHandle, modelUrl, bytes)) {
        exportedFiles += 1;
        totalBytes += bytes.byteLength;
      }
    }
  } catch {}

  return { exportedFiles, skippedFiles, totalBytes };
}
