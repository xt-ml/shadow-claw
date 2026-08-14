import { chunkKey } from "./chunkKey.js";
import { DEFAULT_MODEL_CACHE_NAME, ModelPartialMeta } from "./types.js";

/**
 * Return a ReadableStream that lazily reads all cached chunks in order,
 * yielding the stored bytes without ever assembling a large in-memory Blob.
 */
export function assembleChunkedStream(
  url: string,
  meta: ModelPartialMeta,
  cacheName: string = DEFAULT_MODEL_CACHE_NAME,
): ReadableStream<Uint8Array> {
  let chunkIndex = 0;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      // Drain current chunk reader first
      if (currentReader) {
        const { done, value } = await currentReader.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }

        currentReader = null;
        chunkIndex++;
      }

      // Open next chunk
      if (chunkIndex >= meta.chunks) {
        controller.close();
        return;
      }

      try {
        const cache = await caches.open(cacheName);
        const resp = await cache.match(chunkKey(url, chunkIndex));
        if (!resp?.body) {
          controller.error(
            new Error(
              `ModelCache: missing cache chunk ${chunkIndex} for ${url}`,
            ),
          );
          return;
        }

        currentReader = resp.body.getReader();
        // Read first frame immediately
        const { done, value } = await currentReader.read();
        if (!done) {
          controller.enqueue(value);
        } else {
          currentReader = null;
          chunkIndex++;
          // Will continue on next pull
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      if (currentReader) {
        void currentReader.cancel();
        currentReader = null;
      }
    },
  });
}
