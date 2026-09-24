/**
 * Compute delay with exponential backoff and jitter.
 */
export function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number,
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
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
      const origResolve = resolve;
      resolve = ((value?: any) => {
        signal.removeEventListener("abort", onAbort);
        origResolve(value);
      }) as any;
    }
  });
}
