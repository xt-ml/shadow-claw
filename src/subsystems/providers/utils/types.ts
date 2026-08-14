/**
 * Types and constants for disk-backed model caching via CacheStorage.
 */

export interface ModelPartialMeta {
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
  /** The final redirected URL (e.g. CDN endpoint) used for Range resumes. */
  resolvedUrl?: string;
}

export type ModelProgressCallback = (
  received: number,
  total: number | null,
  fromCache?: boolean,
) => void;

export type ModelCacheStreamProgressCallback = (
  url: string,
  received: number,
  total: number | null,
  complete?: boolean,
) => void;

export interface ModelCacheOptions {
  cacheName?: string;
  chunkSize?: number;
  maxAttempts?: number;
  headers?: Record<string, string>;
}

export const DEFAULT_MODEL_CACHE_NAME = "shadow-claw-browser-models";

/**
 * Flush accumulated bytes to CacheStorage every 16 MiB.
 * Keeps per-write memory allocations manageable on constrained mobile devices (e.g. iOS Safari)
 * while keeping the number of cache entries reasonable.
 */
export const DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024;

export const DEFAULT_MAX_DOWNLOAD_ATTEMPTS = 6;
