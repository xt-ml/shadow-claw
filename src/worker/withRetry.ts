/**
 * Generic retry wrapper with exponential backoff and jitter.
 *
 * @module withRetry
 */

export interface RetryOptions {
  /** Maximum number of retry attempts. */
  maxRetries?: number;
  /** Base delay between retries in ms. */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. */
  maxDelayMs?: number;
  /** Jitter factor (0–1). 0 = no jitter, 1 = full random. */
  jitterFactor?: number;
  /** Predicate that decides whether to retry for a given error and attempt number. */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Callback invoked before each retry sleep. Useful for logging or UI updates. */
  onRetry?: (
    attempt: number,
    maxRetries: number,
    delayMs: number,
    error: any,
  ) => void;
  /** Optional abort signal to cancel retries. */
  signal?: AbortSignal;
}

/**
 * Compute delay with exponential backoff and jitter.
 */
export function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number,
): number {
  // Exponential: base * 2^attempt
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);

  // Apply jitter: value in range [capped * (1 - jitter), capped]
  const jitter = capped * jitterFactor * Math.random();

  return Math.max(0, capped - jitter);
}

/**
 * Sleep for a given number of milliseconds. Respects an optional AbortSignal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));

      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      // Clean up listener when timer fires normally.
      const origResolve = resolve;
      resolve = ((value?: any) => {
        signal.removeEventListener("abort", onAbort);
        origResolve(value);
      }) as any;
    }
  });
}

/**
 * Execute an async function with retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitterFactor = 0.5,
    shouldRetry = () => true,
    onRetry,
    signal,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check abort before each attempt.
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry abort errors.
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      // Last attempt — no more retries.
      if (attempt >= maxRetries) {
        break;
      }

      // Let the caller decide if this error is retryable.
      if (!shouldRetry(error, attempt + 1)) {
        break;
      }

      const delayMs = computeDelay(
        attempt,
        baseDelayMs,
        maxDelayMs,
        jitterFactor,
      );

      if (onRetry) {
        onRetry(attempt + 1, maxRetries, delayMs, error);
      }

      await sleep(delayMs, signal);
    }
  }

  throw lastError;
}

// ── Predefined shouldRetry predicates ──────────────────────────────

/**
 * HTTP status codes that are considered transient/retryable.
 */
export const RETRYABLE_STATUS_CODES = new Set<number>([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * Determine if a fetch Response error (thrown as an object with a `status` field)
 * should be retried.
 */
export function isRetryableHttpError(error: any): boolean {
  // Network errors (TypeError from fetch)
  if (error instanceof TypeError) {
    return true;
  }

  // Errors with an HTTP status code attached
  if (typeof error?.status === "number") {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }

  // Errors with a message that mentions retryable status codes
  if (error instanceof Error) {
    const msg = error.message;
    // Match "API error 429" or "HTTP 503" patterns
    const statusMatch = msg.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
      return RETRYABLE_STATUS_CODES.has(Number(statusMatch[1]));
    }

    // Network-level errors
    if (
      /network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|fetch failed|EAI_AGAIN|EAI_NONAME|getaddrinfo/i.test(
        msg,
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if a fetch_url tool error should be retried.
 * Retries on network errors and transient HTTP status codes.
 */
export function isRetryableFetchError(error: any): boolean {
  // Network errors (TypeError from fetch)
  if (error instanceof TypeError) {
    return true;
  }

  // Response objects from fetch (non-ok status)
  if (error && typeof error.status === "number") {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }

  // Generic errors with network-related messages
  if (error instanceof Error) {
    return /network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|fetch failed|EAI_AGAIN|EAI_NONAME|getaddrinfo/i.test(
      error.message,
    );
  }

  return false;
}
