import { isCacheStorageAvailable } from "./isCacheStorageAvailable.js";
import { metaKey } from "./metaKey.js";
import { DEFAULT_MODEL_CACHE_NAME, ModelPartialMeta } from "./types.js";

/**
 * Persist the partial download metadata to CacheStorage (creates or overwrites).
 */
export async function writePartialMeta(
  url: string,
  meta: ModelPartialMeta,
  cacheName: string = DEFAULT_MODEL_CACHE_NAME,
): Promise<void> {
  if (!isCacheStorageAvailable()) {
    return;
  }

  try {
    const cache = await caches.open(cacheName);
    await cache.put(
      metaKey(url),
      new Response(JSON.stringify(meta), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (err) {
    console.error("writePartialMeta error:", err);
  }
}
