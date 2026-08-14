import { backoffDelayMs } from "./backoffDelayMs.js";
import { chunkKey } from "./chunkKey.js";
import { delayWithAbort } from "./delayWithAbort.js";
import { flushChunkToCache } from "./flushChunkToCache.js";
import { isCacheStorageAvailable } from "./isCacheStorageAvailable.js";
import { readPartialMeta } from "./readPartialMeta.js";
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_MAX_DOWNLOAD_ATTEMPTS,
  DEFAULT_MODEL_CACHE_NAME,
  ModelCacheOptions,
  ModelProgressCallback,
} from "./types.js";
import { writePartialMeta } from "./writePartialMeta.js";

/**
 * Download a model from `url`, persisting bytes to CacheStorage in fixed-size chunks.
 * If a partial download is present from a previous crashed/interrupted session,
 * resumes from where it left off using HTTP Range requests directed at the resolved URL.
 *
 * If CacheStorage is unavailable or fails, gracefully degrades to streaming directly from the network.
 *
 * Returns a live ReadableStream that immediately yields bytes to the consumer as they are downloaded,
 * while simultaneously persisting 16MB chunks to CacheStorage in the background.
 */
export async function downloadModelToCache(
  url: string,
  onProgress?: ModelProgressCallback,
  abortSignal?: AbortSignal,
  options?: ModelCacheOptions,
  nativeFetch: typeof fetch = globalThis.fetch
    ? globalThis.fetch.bind(globalThis)
    : fetch,
): Promise<ReadableStream<Uint8Array>> {
  const cacheName = options?.cacheName ?? DEFAULT_MODEL_CACHE_NAME;
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_DOWNLOAD_ATTEMPTS;
  const customHeaders = options?.headers ?? {};

  const cacheAvailable = isCacheStorageAvailable();

  // ── Restore partial state from a previous session ───────────────────────
  let chunkIndex = 0;
  let received = 0;
  let total: number | null = null;
  let acceptsRanges = false;
  let targetUrl = url;

  if (cacheAvailable) {
    const existingMeta = await readPartialMeta(url, cacheName);
    if (existingMeta && !existingMeta.complete) {
      chunkIndex = existingMeta.chunks;
      received = existingMeta.received;
      total = existingMeta.total;
      acceptsRanges = existingMeta.acceptsRanges;
      if (existingMeta.resolvedUrl) {
        targetUrl = existingMeta.resolvedUrl;
      }
    }
  }

  // ── Initiate network request with retry ──────────────────────────────────
  let lastError: unknown = null;
  let response: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (abortSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const requestHeaders: Record<string, string> = { ...customHeaders };
    if (received > 0 && acceptsRanges) {
      requestHeaders["Range"] = `bytes=${received}-`;
    }

    try {
      response = await nativeFetch(targetUrl, {
        signal: abortSignal,
        headers: requestHeaders,
      });
    } catch (err: any) {
      if (abortSignal?.aborted || err?.name === "AbortError") {
        throw err;
      }

      lastError = err;
      if (attempt < maxAttempts) {
        await delayWithAbort(backoffDelayMs(attempt), abortSignal);
        continue;
      }
      break;
    }

    if (response.url) {
      targetUrl = response.url;
    }

    // Server ignored Range request and returned full 200 — restart from scratch
    if (requestHeaders["Range"] && response.status === 200) {
      chunkIndex = 0;
      received = 0;
    }

    if (response.status !== 200 && response.status !== 206) {
      lastError = new Error(
        `ModelCache: Failed to fetch model from '${targetUrl}': ${response.status} ${response.statusText}`,
      );
      if (response.status >= 500 && attempt < maxAttempts) {
        await delayWithAbort(backoffDelayMs(attempt), abortSignal);
        continue;
      }

      throw lastError;
    }

    if (!response.body) {
      throw new Error(
        `ModelCache: Failed to fetch model from '${targetUrl}': No response body`,
      );
    }

    lastError = null;
    break;
  }

  if (lastError || !response || !response.body) {
    throw new Error(
      `ModelCache: failed to download model from '${url}' after ${maxAttempts} attempts: ${
        (lastError as any)?.message ?? String(lastError)
      }`,
    );
  }

  // Determine total size and range capability
  if (total == null) {
    acceptsRanges =
      response.status === 206 ||
      response.headers.get("accept-ranges") === "bytes";

    if (response.status === 206) {
      const contentRange = response.headers.get("content-range");
      const match = contentRange?.match(/\/\s*(\d+)\s*$/);
      if (match) {
        total = Number(match[1]);
      }
    } else {
      const contentLength = response.headers.get("content-length");
      const parsed = contentLength ? Number(contentLength) : NaN;
      total = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }

  if (cacheAvailable) {
    await writePartialMeta(
      url,
      {
        chunks: chunkIndex,
        received,
        total,
        acceptsRanges,
        complete: false,
        resolvedUrl: targetUrl,
      },
      cacheName,
    );
  }

  const responseBody = response.body;

  // ── Construct live streaming ReadableStream ──────────────────────────────
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // 1. If resuming, replay already cached chunks from CacheStorage first
        if (cacheAvailable && chunkIndex > 0) {
          const cache = await caches.open(cacheName);
          let replayedBytes = 0;
          for (let i = 0; i < chunkIndex; i++) {
            if (abortSignal?.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            const match = await cache.match(chunkKey(url, i));
            if (match?.body) {
              const r = match.body.getReader();
              while (true) {
                const { done, value } = await r.read();
                if (done) break;
                controller.enqueue(value);
                replayedBytes += value.byteLength;
                onProgress?.(replayedBytes, total);
              }
            } else if (
              match &&
              typeof (match as any).arrayBuffer === "function"
            ) {
              const ab = await match.arrayBuffer();
              const chunkData = new Uint8Array(ab);
              controller.enqueue(chunkData);
              replayedBytes += chunkData.byteLength;
              onProgress?.(replayedBytes, total);
            }
          }
        }

        // 2. Stream live bytes from network, persisting chunks as they fill
        let pendingBytes: Uint8Array[] = [];
        let pendingSize = 0;
        let streamReceived = received;

        async function flushPending(): Promise<void> {
          if (pendingSize === 0) return;

          const combined = new Uint8Array(pendingSize);
          let offset = 0;
          for (const b of pendingBytes) {
            combined.set(b, offset);
            offset += b.byteLength;
          }

          pendingBytes = [];
          pendingSize = 0;

          if (cacheAvailable) {
            await flushChunkToCache(url, chunkIndex, combined, cacheName);
            chunkIndex++;
            received += combined.byteLength;

            await writePartialMeta(
              url,
              {
                chunks: chunkIndex,
                received,
                total,
                acceptsRanges,
                complete: false,
                resolvedUrl: targetUrl,
              },
              cacheName,
            );
          } else {
            chunkIndex++;
            received += combined.byteLength;
          }
        }

        const reader = responseBody.getReader();
        try {
          while (true) {
            if (abortSignal?.aborted) {
              await reader.cancel();
              throw new DOMException("Aborted", "AbortError");
            }

            const { done, value } = await reader.read();
            if (done) break;

            controller.enqueue(value);
            pendingBytes.push(value);
            pendingSize += value.byteLength;
            streamReceived += value.byteLength;
            onProgress?.(streamReceived, total);

            if (pendingSize >= chunkSize) {
              await flushPending();
            }
          }

          await flushPending();

          if (cacheAvailable) {
            await writePartialMeta(
              url,
              {
                chunks: chunkIndex,
                received,
                total,
                acceptsRanges,
                complete: true,
                resolvedUrl: targetUrl,
              },
              cacheName,
            );
          }

          onProgress?.(streamReceived, total, true);
          controller.close();
        } catch (streamErr) {
          try {
            await reader.cancel();
          } catch {}
          throw streamErr;
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
