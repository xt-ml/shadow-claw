import { chunkKey } from "./chunkKey.js";
import { isCacheStorageAvailable } from "./isCacheStorageAvailable.js";
import { DEFAULT_MODEL_CACHE_NAME } from "./types.js";

/**
 * Write a single chunk of bytes to CacheStorage.
 * Each chunk is stored as an `application/octet-stream` Response whose body is a Blob wrapping `bytes`.
 */
export async function flushChunkToCache(
  url: string,
  index: number,
  bytes: Uint8Array,
  cacheName: string = DEFAULT_MODEL_CACHE_NAME,
): Promise<void> {
  if (!isCacheStorageAvailable()) {
    return;
  }

  try {
    const cache = await caches.open(cacheName);
    await cache.put(
      chunkKey(url, index),
      new Response(new Blob([bytes as BlobPart]), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(bytes.byteLength),
        },
      }),
    );
  } catch (err) {
    console.error("flushChunkToCache error:", err);
  }
}
