import { assembleChunkedStream } from "./assembleChunkedStream.js";
import { downloadModelToCache } from "./downloadModelToCache.js";
import { readPartialMeta } from "./readPartialMeta.js";
import {
  DEFAULT_MODEL_CACHE_NAME,
  ModelCacheOptions,
  ModelProgressCallback,
} from "./types.js";

/**
 * Load a model stream from CacheStorage if complete; otherwise download and cache it.
 * Supports resume, chunking, and graceful degradation.
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
  const cacheName = options?.cacheName ?? DEFAULT_MODEL_CACHE_NAME;

  // Fast path: a complete chunked download already exists in CacheStorage.
  try {
    const meta = await readPartialMeta(url, cacheName);
    if (meta?.complete) {
      onProgress?.(meta.received, meta.received, true);
      return assembleChunkedStream(url, meta, cacheName);
    }
  } catch (err) {
    console.warn(
      "loadModelStream cache check failed, falling back to download:",
      err,
    );
  }

  // Slow path: download (with crash-resume if an incomplete meta exists).
  return downloadModelToCache(
    url,
    onProgress,
    abortSignal,
    options,
    nativeFetch,
  );
}
