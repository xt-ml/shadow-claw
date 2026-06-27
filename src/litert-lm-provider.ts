/**
 * LiteRT-LM Browser Provider
 *
 * Wraps the Google LiteRT-LM Web API (@litert-lm/core) to provide
 * in-browser LLM inference for Gemma 4 models via WebGPU.
 *
 * https://developers.google.com/edge/litert-lm/js
 *
 * Currently supports:
 *   - litert-community/gemma-4-E2B-it-litert-lm (gemma-4-E2B-it-web.litertlm)
 *   - litert-community/gemma-4-E4B-it-litert-lm (gemma-4-E4B-it-web.litertlm)
 *
 * Model IDs in config use the litert-community HuggingFace repo ID. We resolve
 * the actual .litertlm file URL from the repo's main branch.
 */

import { ShadowClawDatabase } from "./db/db.js";
import { createLogMessage } from "./worker/createLogMessage.js";
import { sanitizeModelOutput } from "./chat-template-sanitizer.js";

/**
 * Map from provider model ID (HuggingFace repo) to the .litertlm web model URL.
 */
const LITERT_LM_MODEL_URLS: Record<string, string> = {
  "litert-community/gemma-4-E2B-it-litert-lm":
    "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm",
  "litert-community/gemma-4-E4B-it-litert-lm":
    "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm",
};

export const LITERT_LM_SUPPORTED_MODELS = Object.keys(LITERT_LM_MODEL_URLS);

export const DEFAULT_LITERT_LM_MODEL =
  "litert-community/gemma-4-E2B-it-litert-lm";

/**
 * Returns true if the LiteRT-LM JS API is available (WebGPU required).
 */
export function isLiteRtLmSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    typeof WebAssembly !== "undefined" &&
    "Suspending" in WebAssembly
  );
}

/**
 * Lazy-loaded LiteRT-LM Engine singleton per model.
 * We keep one engine alive to avoid expensive re-initialization.
 */
let liteRtEngine: any | null = null;
let liteRtEngineModelId: string | null = null;

let liteRtEnginePromise: Promise<any> | null = null;
let liteRtEnginePromiseModelId: string | null = null;

type LiteRtProgressCallback = (
  received: number,
  total: number | null,
  fromCache?: boolean,
) => void;

/**
 * Persistent Cache Storage bucket for downloaded `.litertlm` model weights.
 *
 * We manage this cache directly from the provider (rather than relying on the
 * Workbox runtime cache) so that:
 *   - It survives service-worker updates — the model is NOT re-downloaded every
 *     time the PWA's service worker changes.
 *   - We avoid the "redirected response cannot be cached" failure that occurs
 *     when Workbox tries to `cache.put` HuggingFace's 302 → CDN redirect.
 *   - Downloads can be **resumed after a crash or page reload** — bytes are
 *     flushed to CacheStorage in fixed-size chunks as they arrive, and a JSON
 *     metadata entry tracks how much has been written. On the next page load,
 *     the provider reads the partial meta and issues a `Range` request to
 *     continue from the last flushed byte offset.
 *   - The entire model is **never assembled into a single large Blob**,
 *     preventing the out-of-memory crash on Safari iOS when the final write
 *     would allocate multiple GB at once.
 *
 * Cache Storage is disk-backed and is NOT part of OPFS, so models do not fill
 * the OPFS quota.
 *
 * ### Cache key scheme
 *
 *   `<url>?__sc_meta=1`   — JSON metadata (LiteRtPartialMeta)
 *   `<url>?__sc_chunk=N`  — raw bytes for chunk N (up to LITERT_LM_CHUNK_SIZE)
 */
const LITERT_LM_CACHE_NAME = "shadow-claw-litertlm-models";
const LITERT_LM_MAX_DOWNLOAD_ATTEMPTS = 6;

/**
 * Flush accumulated bytes to CacheStorage every 16 MiB.
 * Small enough to keep per-write allocations manageable on mobile Safari;
 * large enough to keep the number of cache entries reasonable (~128 for a 2 GB
 * model).
 */
const LITERT_LM_CHUNK_SIZE = 16 * 1024 * 1024;

/**
 * Metadata written to CacheStorage to track partial download state across
 * page loads / crashes.
 */
interface LiteRtPartialMeta {
  /** Number of complete chunk entries persisted in CacheStorage. */
  chunks: number;
  /** Total bytes stored across all persisted chunks. */
  received: number;
  /** Known total file size from `Content-Length` / `Content-Range`, or null. */
  total: number | null;
  /** Whether the origin server advertised support for `Range` requests. */
  acceptsRanges: boolean;
  /** True once all bytes have been flushed and the download is complete. */
  complete: boolean;
}

function isCacheStorageAvailable(): boolean {
  return typeof caches !== "undefined" && typeof caches.open === "function";
}

/** Cache key for the JSON metadata entry. */
function metaKey(url: string): string {
  return `${url}?__sc_meta=1`;
}

/** Cache key for chunk number `index`. */
function chunkKey(url: string, index: number): string {
  return `${url}?__sc_chunk=${index}`;
}

/** Read and parse the partial meta entry, or return null if absent/invalid. */
async function readPartialMeta(url: string): Promise<LiteRtPartialMeta | null> {
  if (!isCacheStorageAvailable()) {
    return null;
  }

  try {
    const cache = await caches.open(LITERT_LM_CACHE_NAME);
    const resp = await cache.match(metaKey(url));
    if (!resp?.body) {
      return null;
    }

    const text = await resp.text();

    return JSON.parse(text) as LiteRtPartialMeta;
  } catch {
    return null;
  }
}

/** Persist the partial meta entry (creates or overwrites). */
async function writePartialMeta(
  url: string,
  meta: LiteRtPartialMeta,
): Promise<void> {
  if (!isCacheStorageAvailable()) {
    return;
  }

  try {
    const cache = await caches.open(LITERT_LM_CACHE_NAME);
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

/**
 * Write a single chunk of bytes to CacheStorage.
 * Each chunk is stored as a plain `application/octet-stream` Response whose
 * body is a Blob wrapping exactly `bytes`.
 */
async function flushChunkToCache(
  url: string,
  index: number,
  bytes: Uint8Array,
): Promise<void> {
  if (!isCacheStorageAvailable()) {
    return;
  }

  try {
    const cache = await caches.open(LITERT_LM_CACHE_NAME);
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

/**
 * Return a ReadableStream that lazily reads all cached chunks in order,
 * yielding the stored bytes without ever assembling a large in-memory Blob.
 */
function assembleChunkedStream(
  url: string,
  meta: LiteRtPartialMeta,
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
        const cache = await caches.open(LITERT_LM_CACHE_NAME);
        const resp = await cache.match(chunkKey(url, chunkIndex));
        if (!resp?.body) {
          controller.error(
            new Error(
              `LiteRT-LM: missing cache chunk ${chunkIndex} for ${url}`,
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

function delayWithAbort(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
    }

    const timer = setTimeout(() => {
      abortSignal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };

    abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}

function backoffDelayMs(attempt: number): number {
  return Math.min(15_000, 1_000 * 2 ** (attempt - 1));
}

/**
 * Download the model from `url`, persisting bytes to CacheStorage as 16 MiB
 * chunks.  If a partial download is already present (from a previous crashed
 * session), it resumes from where it left off using HTTP Range requests.
 *
 * Returns a ReadableStream backed by the cached chunks — no large Blob is
 * ever allocated.
 */
async function downloadModelToCache(
  url: string,
  onProgress: LiteRtProgressCallback,
  abortSignal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  // ── Restore partial state from a previous (crashed) session ─────────────
  let chunkIndex = 0; // index of the NEXT chunk to write
  let received = 0; // bytes already persisted to cache
  let total: number | null = null;
  let acceptsRanges = false;

  const existingMeta = await readPartialMeta(url);
  if (existingMeta && !existingMeta.complete) {
    chunkIndex = existingMeta.chunks;
    received = existingMeta.received;
    total = existingMeta.total;
    acceptsRanges = existingMeta.acceptsRanges;
  }

  // ── Pending bytes not yet flushed to a chunk ─────────────────────────────
  let pendingBytes: Uint8Array[] = [];
  let pendingSize = 0;

  /** Flush whatever is in `pendingBytes` as chunk `chunkIndex` and advance. */
  async function flushPending(): Promise<void> {
    if (pendingSize === 0) {
      return;
    }

    const combined = new Uint8Array(pendingSize);
    let offset = 0;
    for (const b of pendingBytes) {
      combined.set(b, offset);
      offset += b.byteLength;
    }

    pendingBytes = [];
    pendingSize = 0;

    await flushChunkToCache(url, chunkIndex, combined);
    chunkIndex++;
    received += combined.byteLength;

    await writePartialMeta(url, {
      chunks: chunkIndex,
      received,
      total,
      acceptsRanges,
      complete: false,
    });
  }

  // ── Download loop with retry + resume ────────────────────────────────────
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= LITERT_LM_MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    if (abortSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const requestHeaders: Record<string, string> = {};
    if (received > 0 && acceptsRanges) {
      requestHeaders["Range"] = `bytes=${received}-`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        signal: abortSignal,
        headers: requestHeaders,
      });
    } catch (err: any) {
      if (abortSignal?.aborted || err?.name === "AbortError") {
        throw err;
      }

      lastError = err;
      if (attempt < LITERT_LM_MAX_DOWNLOAD_ATTEMPTS) {
        await delayWithAbort(backoffDelayMs(attempt), abortSignal);

        continue;
      }

      break;
    }

    // Server ignored our Range request and returned a full 200 — restart.
    if (requestHeaders["Range"] && response.status === 200) {
      // Drop pending buffer and discard already-cached chunks so we start over.
      // (Old chunk cache entries become orphans; they will be overwritten as
      // new chunks arrive at the same indices.)
      pendingBytes = [];
      pendingSize = 0;
      chunkIndex = 0;
      received = 0;
    }

    if (response.status !== 200 && response.status !== 206) {
      lastError = new Error(
        `LiteRT-LM: Failed to fetch model from '${url}': ${response.status} ${response.statusText}`,
      );
      if (response.status >= 500 && attempt < LITERT_LM_MAX_DOWNLOAD_ATTEMPTS) {
        await delayWithAbort(backoffDelayMs(attempt), abortSignal);

        continue;
      }

      throw lastError;
    }

    if (!response.body) {
      throw new Error(
        `LiteRT-LM: Failed to fetch model from '${url}': No response body`,
      );
    }

    // Determine total size and range-resume capability from the response.
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

    // ── Stream bytes, flushing chunks to CacheStorage as we go ───────────
    const reader = response.body.getReader();
    let streamFailed = false;
    // Bytes already accounted for in `received` (i.e. persisted chunks);
    // stream-level bytes not yet flushed sit in `pendingBytes`.
    let streamReceived = received + pendingSize;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        pendingBytes.push(value);
        pendingSize += value.byteLength;
        streamReceived += value.byteLength;
        onProgress(streamReceived, total);

        if (pendingSize >= LITERT_LM_CHUNK_SIZE) {
          await flushPending();
          // After flush, `received` is updated; reset the stream-level tracker.
          streamReceived = received;
        }
      }
    } catch (err: any) {
      if (abortSignal?.aborted || err?.name === "AbortError") {
        throw err;
      }

      lastError = err;
      streamFailed = true;
      try {
        await reader.cancel();
      } catch {}

      // If the server supports Range, we can resume from last flush boundary;
      // drop only the unflushed pending buffer.
      // If the server doesn't support Range, we must restart entirely.
      if (!acceptsRanges) {
        pendingBytes = [];
        pendingSize = 0;
        chunkIndex = 0;
        received = 0;
      } else {
        // Drop only the un-flushed pending bytes; keep already-cached chunks.
        pendingBytes = [];
        pendingSize = 0;
      }
    }

    if (!streamFailed) {
      lastError = null;

      break;
    }

    if (attempt < LITERT_LM_MAX_DOWNLOAD_ATTEMPTS) {
      await delayWithAbort(backoffDelayMs(attempt), abortSignal);
    }
  }

  if (lastError) {
    throw new Error(
      `LiteRT-LM: failed to download model from '${url}' after ${
        LITERT_LM_MAX_DOWNLOAD_ATTEMPTS
      } attempts: ${(lastError as any)?.message ?? String(lastError)}`,
    );
  }

  // Flush any remaining bytes that didn't fill a complete chunk.
  await flushPending();

  // Mark download complete in the meta entry.
  const finalMeta: LiteRtPartialMeta = {
    chunks: chunkIndex,
    received,
    total,
    acceptsRanges,
    complete: true,
  };
  await writePartialMeta(url, finalMeta);

  return assembleChunkedStream(url, finalMeta);
}

export async function loadLiteRtModelStream(
  url: string,
  onProgress: LiteRtProgressCallback,
  abortSignal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  // Fast path: a complete chunked download already exists in CacheStorage.
  const meta = await readPartialMeta(url);
  if (meta?.complete) {
    onProgress(meta.received, meta.received, true);

    return assembleChunkedStream(url, meta);
  }

  // Slow path: download (with crash-resume if an incomplete meta exists).

  return downloadModelToCache(url, onProgress, abortSignal);
}

async function getLiteRtEngine(
  modelId: string,
  onProgress?: LiteRtProgressCallback,
  abortSignal?: AbortSignal,
): Promise<any> {
  if (liteRtEngineModelId === modelId && liteRtEngine) {
    return liteRtEngine;
  }

  if (liteRtEnginePromise && liteRtEnginePromiseModelId === modelId) {
    return liteRtEnginePromise;
  }

  liteRtEnginePromiseModelId = modelId;
  liteRtEnginePromise = (async () => {
    if (liteRtEngine) {
      try {
        await liteRtEngine.delete?.();
      } catch {}

      liteRtEngine = null;
      liteRtEngineModelId = null;
    }

    const modelUrl = LITERT_LM_MODEL_URLS[modelId];
    if (!modelUrl) {
      throw new Error(
        `LiteRT-LM: Model '${modelId} is not supported. Supported models: ${LITERT_LM_SUPPORTED_MODELS.join(", ")}`,
      );
    }

    const litertlm = await import("@litert-lm/core").catch(() => {
      throw new Error(
        "LiteRT-LM: The @litert-lm/core package is not installed. Run: npm install @litert-lm/core",
      );
    });

    const Engine: any = litertlm.Engine ?? (litertlm as any).default?.Engine;
    if (typeof Engine?.create !== "function") {
      throw new Error(
        "LiteRT-LM: Could not locate Engine.create in @litert-lm/core. Ensure you have the latest version installed.",
      );
    }

    const modelStream = await loadLiteRtModelStream(
      modelUrl,
      onProgress ?? (() => {}),
      abortSignal,
    );

    const engine = await Engine.create({
      model: modelStream,
      mainExecutorSettings: {
        maxNumTokens: 8192,
      },
    });

    liteRtEngine = engine;
    liteRtEngineModelId = modelId;

    return engine;
  })();

  try {
    return await liteRtEnginePromise;
  } finally {
    liteRtEnginePromise = null;
    liteRtEnginePromiseModelId = null;
  }
}

/**
 * Map ShadowClaw internal message format to the LiteRT-LM conversation preface.
 * System prompts are passed as a preface; user/assistant turns are sent
 * individually via sendMessageStreaming.
 */
function buildLiteRtMessages(
  systemPrompt: string,
  messages: any[],
): { preface: any[]; turns: string[] } {
  const preface: any[] = [];
  if (systemPrompt) {
    preface.push({ role: "system", content: systemPrompt });
  }

  // Build prior turns as a flat prompt transcript (LiteRT-LM conversation is
  // stateful so we replay prior turns by sending them sequentially).
  // For a single-turn invocation we just send the latest user message.
  const turns: string[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      const content = Array.isArray(msg.content)
        ? msg.content
            .map((b: any) => {
              if (b?.type === "text") {
                return b.text;
              }

              if (b?.type === "tool_result") {
                return `[Tool result] ${String(b.content || "")}`;
              }

              return "";
            })
            .filter(Boolean)
            .join("\n")
        : String(msg.content || "");
      if (content) {
        turns.push(content);
      }
    }
  }

  return { preface, turns };
}

/**
 * Main entry point. Invokes the LiteRT-LM browser engine and streams the
 * response back via the emit callback, following the same protocol as
 * invokeWithTransformersJs / invokeWithPromptApi.
 */
export async function invokeWithLiteRtLm(
  _db: ShadowClawDatabase,
  groupId: string,
  systemPrompt: string,
  messages: any[],
  _maxTokens: number,
  emit: (message: any) => Promise<void> | void,
  abortSignal: AbortSignal | undefined,
  modelId: string,
) {
  if (!isLiteRtLmSupported()) {
    await emit({
      type: "response",
      payload: {
        groupId,
        text: "⚠️ LiteRT-LM requires WebGPU and WebAssembly.Suspending. These are not both available in this browser.",
      },
    });

    return;
  }

  await emit(
    createLogMessage(
      groupId,
      "info",
      "Starting",
      `Provider: LiteRT-LM (Browser · WebGPU) · Model: ${modelId}`,
    ),
  );

  // Emit model-download-progress so the UI shows a loading state
  await emit({
    type: "model-download-progress",
    payload: {
      groupId,
      status: "running",
      progress: 0,
      message: `Loading LiteRT-LM model: ${modelId}…`,
    },
  });

  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(0);

  let lastEmittedPct = -1;

  const onProgress: LiteRtProgressCallback = (received, total, fromCache) => {
    const progress = total ? received / total : null;
    const pct = progress != null ? Math.floor(progress * 100) : -1;

    if (pct === lastEmittedPct && !fromCache) {
      return;
    }

    lastEmittedPct = pct;

    const message = fromCache
      ? `Loaded ${modelId} from cache (${formatMb(received)} MB )`
      : total
        ? `Downloading ${modelId}: ${formatMb(received)} / ${formatMb(total)} MB`
        : `Downloading ${modelId}: ${formatMb(received)} MB`;

    void emit({
      type: "model-download-progress",
      payload: { groupId, status: "running", progress, message },
    });
  };

  let engine: any;

  try {
    engine = await getLiteRtEngine(modelId, onProgress, abortSignal);
  } catch (err: any) {
    if (abortSignal?.aborted || err?.name === "AbortError") {
      await emit({
        type: "model-download-progress",
        payload: {
          groupId,
          status: "error",
          progress: null,
          message: "LiteRT-LM model download cancelled.",
        },
      });

      return;
    }

    await emit({
      type: "model-download-progress",
      payload: {
        groupId,
        status: "error",
        progress: null,
        message: `LiteRT-LM model failed to load: ${err?.message ?? String(err)}`,
      },
    });

    await emit({
      type: "response",
      payload: {
        groupId,
        text: `⚠️ LiteRT-LM failed to initialize: ${err?.message ?? String(err)}`,
      },
    });

    return;
  }

  await emit({
    type: "model-download-progress",
    payload: {
      groupId,
      status: "done",
      progress: 1,
      message: "LiteRT-LM model ready.",
    },
  });

  const { preface, turns } = buildLiteRtMessages(systemPrompt, messages);

  let conversation: any;
  try {
    conversation = await engine.createConversation({
      preface: { messages: preface },
    });
  } catch (err: any) {
    await emit({
      type: "response",
      payload: {
        groupId,
        text: `⚠️ LiteRT-LM failed to create conversation: ${err?.message ?? String(err)}`,
      },
    });

    return;
  }

  // Replay prior turns (if any) — LiteRT-LM conversation is stateful.
  // All turns except the final user turn are sent non-streaming.
  const priorTurns = turns.slice(0, -1);
  const lastTurn = turns[turns.length - 1] ?? "Hello.";

  for (const turn of priorTurns) {
    if (abortSignal?.aborted) {
      return;
    }

    try {
      await conversation.sendMessage(turn);
    } catch {
      // If replaying history fails, continue to latest turn anyway
    }
  }

  if (abortSignal?.aborted) {
    return;
  }

  await emit({ type: "streaming-start", payload: { groupId } });

  let accumulated = "";
  try {
    const stream = conversation.sendMessageStreaming(lastTurn);
    for await (const chunk of stream) {
      if (abortSignal?.aborted) {
        break;
      }

      const text = chunk?.content?.[0]?.text ?? "";
      if (text) {
        const cleaned = sanitizeModelOutput(text, "openai");
        if (cleaned) {
          accumulated += cleaned;
          await emit({
            type: "streaming-chunk",
            payload: { groupId, text: cleaned },
          });
        }
      }
    }
  } catch (err: any) {
    if (abortSignal?.aborted) {
      return;
    }

    await emit({
      type: "response",
      payload: {
        groupId,
        text: `⚠️ LiteRT-LM generation error: ${err?.message ?? String(err)}`,
      },
    });

    return;
  }

  await emit({
    type: "streaming-done",
    payload: { groupId, text: accumulated },
  });

  await emit({
    type: "response",
    payload: { groupId, text: accumulated },
  });
}
