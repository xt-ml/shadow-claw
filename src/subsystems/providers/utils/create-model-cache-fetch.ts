import { assembleChunkedStream } from "./assemble-chunked-stream.js";
import { isCacheStorageAvailable } from "./is-cache-storage-available.js";
import { loadModelStream } from "./load-model-stream.js";
import { readPartialMeta } from "./read-partial-meta.js";
import {
  loadSharedModelCacheConfig,
  maybeBackfillSharedDir,
  readFallbackBrowserModel,
  readModelFromSharedDir,
  resolveModelCacheName,
} from "./shared-model-cache.js";
import {
  DEFAULT_MODEL_CACHE_NAME,
  type ModelCacheOptions,
  type ModelCacheStreamProgressCallback,
  type SharedModelCacheConfig,
} from "./types.js";

let activeModelCacheProgressHook: ModelCacheStreamProgressCallback | null =
  null;

export function setModelCacheProgressHook(
  hook: ModelCacheStreamProgressCallback | null,
): void {
  activeModelCacheProgressHook = hook;
}

export function getModelCacheProgressHook(): ModelCacheStreamProgressCallback | null {
  return activeModelCacheProgressHook;
}

export function clearModelCacheProgressHook(): void {
  activeModelCacheProgressHook = null;
}

/**
 * Creates a fetch-compatible interceptor function that leverages disk-backed CacheStorage
 * (plus opt-in cross-origin shared folder and mirror server) for model weights.
 */
export function createModelCacheFetch(
  nativeFetch: typeof fetch = globalThis.fetch
    ? globalThis.fetch.bind(globalThis)
    : fetch,
  cacheOptions?: ModelCacheOptions,
  progressCallback?: ModelCacheStreamProgressCallback,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async function modelCacheFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const method = (
      init?.method ||
      (typeof input === "object" && "method" in input ? input.method : "GET") ||
      "GET"
    ).toUpperCase();

    // Check for Range headers
    const hdrs =
      init?.headers ||
      (typeof input === "object" && "headers" in input
        ? input.headers
        : undefined);
    const hasRange =
      hdrs instanceof Headers
        ? hdrs.has("Range") || hdrs.has("range")
        : hdrs && typeof hdrs === "object"
          ? "Range" in hdrs || "range" in hdrs
          : false;

    if (hasRange) {
      return nativeFetch(input, {
        ...(init || {}),
        cache: "no-store",
      });
    }

    if (method !== "GET" || !isCacheStorageAvailable()) {
      return nativeFetch(input, init);
    }

    try {
      const baseConfig = await loadSharedModelCacheConfig();
      const effectiveConfig: SharedModelCacheConfig = {
        ...baseConfig,
        ...(cacheOptions?.sharedConfig || {}),
      };
      const cacheName = resolveModelCacheName(
        cacheOptions?.cacheName ?? DEFAULT_MODEL_CACHE_NAME,
        effectiveConfig.scope,
      );

      const meta = await readPartialMeta(urlStr, cacheName);
      if (meta?.complete) {
        progressCallback?.(urlStr, meta.received, meta.received, true);
        activeModelCacheProgressHook?.(
          urlStr,
          meta.received,
          meta.received,
          true,
        );
        const stream = await maybeBackfillSharedDir(
          effectiveConfig.dirHandle,
          urlStr,
          assembleChunkedStream(urlStr, meta, cacheName),
        );
        return new Response(stream, {
          status: 200,
          statusText: "OK",
          headers: {
            "Content-Type": "application/octet-stream",
            ...(meta.total != null && meta.total > 0
              ? { "Content-Length": String(meta.total) }
              : {}),
          },
        });
      }

      const fallbackHit = await readFallbackBrowserModel(
        urlStr,
        cacheOptions?.cacheName ?? DEFAULT_MODEL_CACHE_NAME,
        effectiveConfig.scope,
      );
      if (fallbackHit) {
        progressCallback?.(
          urlStr,
          fallbackHit.received,
          fallbackHit.received,
          true,
        );
        activeModelCacheProgressHook?.(
          urlStr,
          fallbackHit.received,
          fallbackHit.received,
          true,
        );
        const stream = await maybeBackfillSharedDir(
          effectiveConfig.dirHandle,
          urlStr,
          fallbackHit.stream,
        );
        return new Response(stream, {
          status: 200,
          statusText: "OK",
          headers: {
            "Content-Type": "application/octet-stream",
            ...(fallbackHit.total != null && fallbackHit.total > 0
              ? { "Content-Length": String(fallbackHit.total) }
              : {}),
          },
        });
      }

      if (effectiveConfig.dirHandle) {
        const sharedHit = await readModelFromSharedDir(
          effectiveConfig.dirHandle,
          urlStr,
        );
        if (sharedHit) {
          progressCallback?.(urlStr, sharedHit.size, sharedHit.size, true);
          activeModelCacheProgressHook?.(
            urlStr,
            sharedHit.size,
            sharedHit.size,
            true,
          );
          return new Response(sharedHit.stream, {
            status: 200,
            statusText: "OK",
            headers: {
              "Content-Type": "application/octet-stream",
              ...(sharedHit.size > 0
                ? { "Content-Length": String(sharedHit.size) }
                : {}),
            },
          });
        }
      }

      const stream = await loadModelStream(
        urlStr,
        (received, total, complete) => {
          progressCallback?.(urlStr, received, total, !!complete);
          activeModelCacheProgressHook?.(urlStr, received, total, !!complete);
        },
        init?.signal ?? undefined,
        {
          ...(cacheOptions || {}),
          cacheName,
          sharedConfig: effectiveConfig,
        },
        nativeFetch,
      );

      const latestMeta = await readPartialMeta(urlStr, cacheName);
      const totalSize = latestMeta?.total;

      return new Response(stream, {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/octet-stream",
          ...(totalSize != null && totalSize > 0
            ? { "Content-Length": String(totalSize) }
            : {}),
        },
      });
    } catch (err) {
      console.warn(
        `[ModelCacheFetch] Cache stream failed for ${urlStr}, falling back to native fetch:`,
        err,
      );
      return nativeFetch(input, init);
    }
  };
}
