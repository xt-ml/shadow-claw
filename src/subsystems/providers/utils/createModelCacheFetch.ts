import { assembleChunkedStream } from "./assembleChunkedStream.js";
import { isCacheStorageAvailable } from "./isCacheStorageAvailable.js";
import { loadModelStream } from "./loadModelStream.js";
import { readPartialMeta } from "./readPartialMeta.js";
import {
  DEFAULT_MODEL_CACHE_NAME,
  ModelCacheOptions,
  ModelCacheStreamProgressCallback,
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
 * for model weight and resource downloads.
 *
 * Designed to be passed into Transformers.js `(env as any).fetch` and browser AI polyfills.
 *
 * Features:
 * - Range header bypass: Passes Range probes (e.g. `bytes=0-0`) directly to native fetch with `cache: "no-store"`.
 * - Disk-backed chunk caching: Persists weights to CacheStorage in chunks without OPFS quota limits.
 * - Live streaming: Returns streaming Response with Content-Length immediately so progress callbacks update in real-time.
 * - Graceful degradation: Falls back to native fetch on non-GET methods, errors, or when CacheStorage is unavailable.
 */
export function createModelCacheFetch(
  nativeFetch: typeof fetch = globalThis.fetch
    ? globalThis.fetch.bind(globalThis)
    : fetch,
  cacheOptions?: ModelCacheOptions,
  progressCallback?: ModelCacheStreamProgressCallback,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const cacheName = cacheOptions?.cacheName ?? DEFAULT_MODEL_CACHE_NAME;

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
      const meta = await readPartialMeta(urlStr, cacheName);
      if (meta?.complete) {
        progressCallback?.(urlStr, meta.received, meta.received, true);
        activeModelCacheProgressHook?.(
          urlStr,
          meta.received,
          meta.received,
          true,
        );
        const stream = assembleChunkedStream(urlStr, meta, cacheName);
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

      const stream = await loadModelStream(
        urlStr,
        (received, total, complete) => {
          progressCallback?.(urlStr, received, total, !!complete);
          activeModelCacheProgressHook?.(urlStr, received, total, !!complete);
        },
        init?.signal ?? undefined,
        {
          cacheName,
          ...(cacheOptions || {}),
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
