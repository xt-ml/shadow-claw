import { assembleChunkedStream } from "./assemble-chunked-stream.js";
import { downloadModelToCache } from "./download-model-to-cache.js";
import { readPartialMeta } from "./read-partial-meta.js";
import {
  buildModelFetchInit,
  loadSharedModelCacheConfig,
  maybeBackfillSharedDir,
  readFallbackBrowserModel,
  readModelFromSharedDir,
  resolveMirrorModelUrl,
  resolveModelCacheName,
  writeModelToSharedDir,
} from "./shared-model-cache.js";
import {
  DEFAULT_MODEL_CACHE_NAME,
  type ModelCacheOptions,
  type ModelProgressCallback,
  type SharedModelCacheConfig,
} from "./types.js";

function createMirrorAwareFetch(
  nativeFetch: typeof fetch,
  cfg: SharedModelCacheConfig,
): typeof fetch {
  if (!cfg.mirrorEnabled || !cfg.mirrorUrl) {
    return nativeFetch;
  }

  return async function mirrorFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const mirrorUrl = resolveMirrorModelUrl(urlStr, cfg.mirrorUrl);
    if (mirrorUrl) {
      try {
        const mirrorRes = await nativeFetch(
          mirrorUrl,
          buildModelFetchInit(mirrorUrl, init),
        );
        if (
          mirrorRes &&
          (mirrorRes.ok || (mirrorRes.status >= 200 && mirrorRes.status < 300))
        ) {
          return mirrorRes;
        }
      } catch {}
    }

    return nativeFetch(input, init);
  };
}

/**
 * Load a model stream from CacheStorage (or opt-in shared folder / mirror) if available;
 * otherwise download and cache it. Supports resume, chunking, and graceful degradation.
 */
export async function loadModelStream(
  url: string,
  onProgress?: ModelProgressCallback,
  abortSignal?: AbortSignal,
  options?: ModelCacheOptions,
  nativeFetch: typeof fetch = globalThis.fetch
    ? globalThis.fetch.bind(globalThis)
    : fetch,
): Promise<ReadableStream<Uint8Array>> {
  const baseConfig = await loadSharedModelCacheConfig();
  const effectiveConfig: SharedModelCacheConfig = {
    ...baseConfig,
    ...(options?.sharedConfig || {}),
  };

  const baseCacheName = options?.cacheName ?? DEFAULT_MODEL_CACHE_NAME;
  const cacheName = resolveModelCacheName(baseCacheName, effectiveConfig.scope);

  // Fast path 1: a complete chunked download already exists in CacheStorage.
  try {
    const meta = await readPartialMeta(url, cacheName);
    if (meta?.complete) {
      onProgress?.(meta.received, meta.received, true);
      const cachedStream = assembleChunkedStream(url, meta, cacheName);
      return await maybeBackfillSharedDir(
        effectiveConfig.dirHandle,
        url,
        cachedStream,
      );
    }

    const fallbackHit = await readFallbackBrowserModel(
      url,
      baseCacheName,
      effectiveConfig.scope,
    );
    if (fallbackHit) {
      onProgress?.(fallbackHit.received, fallbackHit.received, true);
      return await maybeBackfillSharedDir(
        effectiveConfig.dirHandle,
        url,
        fallbackHit.stream,
      );
    }
  } catch (err) {
    console.warn(
      "loadModelStream cache check failed, falling back to download:",
      err,
    );
  }

  // Fast path 2: opt-in cross-origin shared local folder hit.
  if (effectiveConfig.dirHandle) {
    const sharedHit = await readModelFromSharedDir(
      effectiveConfig.dirHandle,
      url,
    );
    if (sharedHit) {
      onProgress?.(sharedHit.size, sharedHit.size, true);
      return sharedHit.stream;
    }
  }

  // Slow path: download (with opt-in mirror and crash-resume).
  const stream = await downloadModelToCache(
    url,
    onProgress,
    abortSignal,
    {
      ...options,
      cacheName,
    },
    createMirrorAwareFetch(nativeFetch, effectiveConfig),
  );

  // Opt-in write-through to shared local folder in background.
  if (effectiveConfig.dirHandle && typeof stream.tee === "function") {
    const [consumerStream, mirrorWriteStream] = stream.tee();
    void writeModelToSharedDir(
      effectiveConfig.dirHandle,
      url,
      mirrorWriteStream,
    ).catch(() => {});
    return consumerStream;
  }

  return stream;
}
