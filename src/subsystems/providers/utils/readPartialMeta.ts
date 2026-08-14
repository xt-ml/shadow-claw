import { isCacheStorageAvailable } from "./isCacheStorageAvailable.js";
import { metaKey } from "./metaKey.js";
import { DEFAULT_MODEL_CACHE_NAME, ModelPartialMeta } from "./types.js";

/**
 * Read and parse the partial download metadata from CacheStorage.
 * Returns null if absent, invalid, or if CacheStorage is unavailable.
 */
export async function readPartialMeta(
  url: string,
  cacheName: string = DEFAULT_MODEL_CACHE_NAME,
): Promise<ModelPartialMeta | null> {
  if (!isCacheStorageAvailable()) {
    return null;
  }

  try {
    const cache = await caches.open(cacheName);
    const resp = await cache.match(metaKey(url));
    if (!resp?.body) {
      return null;
    }

    const text = await resp.text();
    return JSON.parse(text) as ModelPartialMeta;
  } catch {
    return null;
  }
}
