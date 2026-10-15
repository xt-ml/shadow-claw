import fs from "node:fs";
import { mkdir, stat, rename, unlink, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Module-level event target that fires real-time download progress events from
 * `downloadWithResume`. Subscribe to this from `transformers-runtime.ts` to
 * bridge the gap between `env.fetch` (where network I/O happens) and the
 * Transformers.js `progress_callback` (which is only passed to `from_pretrained`).
 *
 * Events fire `DownloadProgressEvent` objects with the following detail:
 * `{ file, loaded, total, progress, resumeOffset }`
 */
export const modelDownloadEvents = new EventTarget();

export interface DownloadProgressDetail {
  /** Relative file path / cache key (e.g. "onnx-community/model/tokenizer.json") */
  file: string;
  /** Bytes downloaded so far (cumulative, including resumeOffset) */
  loaded: number;
  /** Total bytes (0 if unknown) */
  total: number;
  /** 0-100 progress percentage (0 if total unknown) */
  progress: number;
  /** Bytes already on disk when the resume started */
  resumeOffset: number;
}

export class DownloadProgressEvent extends Event {
  readonly detail: DownloadProgressDetail;
  constructor(detail: DownloadProgressDetail) {
    super("progress");
    this.detail = detail;
  }
}

export interface FileModelCacheFetchOptions {
  cacheDir: string;
  nativeFetch?: typeof fetch;
}

/**
 * Parses Hugging Face resolve/raw URLs to extract repoId, revision, and relative file path.
 *
 * Example:
 * https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX/resolve/main/tokenizer.json
 * -> repoId: "onnx-community/gemma-4-E4B-it-ONNX", revision: "main", filePath: "tokenizer.json"
 */
export function parseModelFileUrl(urlStr: string): {
  repoId: string;
  revision: string;
  filePath: string;
} | null {
  try {
    const parsed = new URL(urlStr);
    const match = parsed.pathname.match(
      /^\/(.+?)\/(?:resolve|raw)\/([^/]+)\/(.+)$/,
    );
    if (!match) return null;
    return {
      repoId: decodeURIComponent(match[1]),
      revision: decodeURIComponent(match[2]),
      filePath: decodeURIComponent(match[3]),
    };
  } catch {
    return null;
  }
}

/**
 * Downloads a file to `targetPath` with resume support using a stable `.part` temp file.
 *
 * ### Why stable `.part` instead of random `.tmp.PID.random`
 *
 * Transformers.js `FileCache.put()` uses random `.tmp.PID.random` names and **deletes**
 * them in its catch block on any error. This means any data written during an interrupted
 * download (SIGINT, network drop) is lost and cannot be resumed.
 *
 * This function bypasses that entirely by downloading directly to the final FileCache path
 * using a stable `<targetPath>.part` name. On interruption the `.part` file survives.
 * On the next run, we read its size, send `Range: bytes=N-`, and append only what's missing.
 *
 * ### Behaviour summary
 *
 * - `targetPath` already exists → returns immediately (file complete).
 * - `targetPath.part` exists → resumes with `Range: bytes=<size>-`.
 * - Otherwise → fresh download writing to `targetPath.part`.
 * - On completion → atomically renames `.part` → `targetPath`.
 * - On interruption → `.part` remains for next resume.
 *
 * @param remoteUrl  Full HTTPS URL to fetch.
 * @param targetPath Absolute path to the final destination file.
 * @param nativeFetch The raw fetch function (injected for testability).
 * @param signal Optional AbortSignal to cancel the download.
 * @param onProgress Optional progress callback fired on each network chunk.
 */
export async function downloadWithResume(
  remoteUrl: string,
  targetPath: string,
  nativeFetch: typeof fetch,
  signal?: AbortSignal,
  onProgress?: (detail: DownloadProgressDetail) => void,
): Promise<void> {
  // Already complete — nothing to do.
  const completeStat = await stat(targetPath).catch(() => null);
  if (completeStat?.isFile() && completeStat.size > 0) {
    return;
  }

  const partPath = `${targetPath}.part`;
  const targetDir = path.dirname(targetPath);
  await mkdir(targetDir, { recursive: true });

  // Clean up stale random .tmp.* files left behind by prior FileCache.put() calls.
  try {
    const entries = await readdir(targetDir);
    const base = path.basename(targetPath);
    for (const entry of entries) {
      if (entry.startsWith(base) && entry.includes(".tmp.")) {
        await unlink(path.join(targetDir, entry)).catch(() => {});
      }
    }
  } catch {}

  // Determine resume offset from an existing .part file.
  let resumeOffset = 0;
  const partStat = await stat(partPath).catch(() => null);
  if (partStat?.isFile() && partStat.size > 0) {
    resumeOffset = partStat.size;
  }

  // Build request headers.
  const reqHeaders: Record<string, string> = {
    "Accept-Encoding": "identity",
  };
  if (resumeOffset > 0) {
    reqHeaders["Range"] = `bytes=${resumeOffset}-`;
  }

  let response = await nativeFetch(remoteUrl, { headers: reqHeaders, signal });

  // 416 Range Not Satisfiable: stale .part (server file changed) — restart from scratch.
  if (response.status === 416 && resumeOffset > 0) {
    await unlink(partPath).catch(() => {});
    resumeOffset = 0;
    delete reqHeaders["Range"];
    response = await nativeFetch(remoteUrl, { headers: reqHeaders, signal });
  }

  if (!response.ok && response.status !== 206) {
    throw new Error(
      `Failed to fetch ${remoteUrl}: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error(`No response body for ${remoteUrl}`);
  }

  // If server returned 200 (not 206), it didn't honour our Range — start from zero.
  if (response.status === 200 && resumeOffset > 0) {
    resumeOffset = 0;
  }

  // Determine total file size for progress reporting.
  let totalSize = 0;
  const is206 = response.status === 206;
  if (is206) {
    const contentRange = response.headers.get("content-range");
    const m = contentRange?.match(/\/\s*(\d+)\s*$/);
    if (m) {
      totalSize = Number(m[1]);
    } else {
      const cl = response.headers.get("content-length");
      totalSize = cl ? resumeOffset + Number(cl) : 0;
    }
  } else {
    const cl = response.headers.get("content-length");
    totalSize = cl ? Number(cl) : 0;
  }

  // Derive a short file key for progress events (relative path within the cache).
  const fileKey =
    path.basename(path.dirname(targetPath)) + "/" + path.basename(targetPath);

  const appendStream = fs.createWriteStream(partPath, {
    flags: resumeOffset > 0 ? "a" : "w",
  });

  let loaded = resumeOffset;

  const reader = response.body.getReader();
  try {
    while (true) {
      if (signal?.aborted) {
        appendStream.end();
        await reader.cancel().catch(() => {});
        throw new DOMException("Aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) break;

      await new Promise<void>((resolve, reject) => {
        appendStream.write(value, (err) => (err ? reject(err) : resolve()));
      });

      loaded += value.length;
      const progress = totalSize > 0 ? (loaded / totalSize) * 100 : 0;

      const detail: DownloadProgressDetail = {
        file: fileKey,
        loaded,
        total: totalSize,
        progress,
        resumeOffset,
      };

      onProgress?.(detail);
      modelDownloadEvents.dispatchEvent(new DownloadProgressEvent(detail));
    }

    await new Promise<void>((resolve, reject) => {
      appendStream.close((err) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    appendStream.end();
    await reader.cancel().catch(() => {});
    // Leave .part on disk so next run can resume.
    throw err;
  }

  // Atomically promote .part → final file.
  await rename(partPath, targetPath);
}

/**
 * Returns a streaming Response backed by the on-disk file at `targetPath`.
 */
function fileResponseStream(targetPath: string, fileSize: number): Response {
  const fileStream = fs.createReadStream(targetPath);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream.on("data", (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        controller.enqueue(
          new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
        );
      });
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      fileStream.destroy();
    },
  });

  return new Response(stream, {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(fileSize),
    },
  });
}

/**
 * Creates a fetch-compatible interceptor for Transformers.js `env.fetch` that enables
 * resumable model downloads in Node.js CLI environments.
 *
 * ### How it works
 *
 * The core issue with Transformers.js is that `FileCache.put()` uses random
 * `.tmp.PID.random` temp files and **deletes** them on error, so interrupted downloads
 * are always restarted from zero.
 *
 * This interceptor bypasses `FileCache.put()` entirely:
 * 1. It downloads the file directly to the FileCache path using `downloadWithResume()`,
 *    which writes to a stable `<path>.part` temp file.
 * 2. Once the download is complete (or resumes to completion), the `.part` file is
 *    atomically renamed to the final path.
 * 3. It returns a streaming `Response` backed by the on-disk file.
 * 4. Because the file is already on disk, `FileCache.match()` finds it as a cache hit
 *    immediately — `FileCache.put()` is **never called**.
 *
 * ### Resume behaviour
 *
 * - On SIGINT or network error, the `.part` file persists intact on disk.
 * - On the next invocation, `downloadWithResume()` reads the `.part` size, sends
 *   `Range: bytes=N-`, and appends only the remaining bytes.
 * - Once complete, `.part` is atomically renamed to its final path.
 */
export function createFileModelCacheFetch(
  options: FileModelCacheFetchOptions,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const { cacheDir, nativeFetch = globalThis.fetch.bind(globalThis) } = options;

  return async function fileModelCacheFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    const method = (
      init?.method ||
      (typeof input === "object" && "method" in input
        ? (input as any).method
        : "GET") ||
      "GET"
    ).toUpperCase();

    // Pass through non-GET requests and requests with an explicit Range header
    // (e.g. metadata probes, LFS size checks) unchanged.
    const hdrs =
      init?.headers ||
      (typeof input === "object" && "headers" in input
        ? (input as any).headers
        : undefined);
    const hasExplicitRange =
      hdrs instanceof Headers
        ? hdrs.has("Range") || hdrs.has("range")
        : hdrs && typeof hdrs === "object"
          ? "Range" in hdrs || "range" in hdrs
          : false;

    if (method !== "GET" || hasExplicitRange) {
      return nativeFetch(input, init);
    }

    const parsedInfo = parseModelFileUrl(urlStr);
    if (!parsedInfo) {
      return nativeFetch(input, init);
    }

    const { repoId, revision, filePath } = parsedInfo;

    // Compute the FileCache cache key — must match hub.js `buildResourcePaths` exactly:
    //   revision === 'main'  → path.join(repoId, filename)
    //   otherwise            → path.join(repoId, revision, filename)
    const cacheKey =
      revision === "main"
        ? path.join(repoId, filePath)
        : path.join(repoId, revision, filePath);

    const targetPath = path.resolve(cacheDir, cacheKey);

    // Download (with resume) directly to the FileCache path before returning.
    // This ensures FileCache.match() finds the file immediately (cache hit),
    // so FileCache.put() is never invoked and no .tmp.PID.random files are created.
    await downloadWithResume(
      urlStr,
      targetPath,
      nativeFetch,
      init?.signal as AbortSignal | undefined,
    );

    // Return a streaming Response backed by the completed on-disk file.
    const fileStat = await stat(targetPath);
    return fileResponseStream(targetPath, fileStat.size);
  };
}

/**
 * @deprecated No-op. `FileCache` is an internal class in `@huggingface/transformers`
 * that is not exported and cannot be accessed via module reflection. The resume
 * strategy is implemented entirely via `createFileModelCacheFetch` (which writes to
 * stable `.part` files via `env.fetch`) combined with `modelDownloadEvents` (which
 * bridges download progress back to the Transformers.js `progress_callback` chain).
 *
 * Kept as a no-op export so call-sites in `transformers-runtime.ts` do not need to
 * be updated. It is safe to remove calls to this function entirely.
 */
export function patchFileCacheForResume(
  _transformers: any,
  _nativeFetch?: typeof fetch,
): void {
  // No-op: FileCache is not accessible via module exports.
  // Resume is handled by createFileModelCacheFetch + modelDownloadEvents.
}
