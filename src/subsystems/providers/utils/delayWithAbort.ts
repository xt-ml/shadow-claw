/**
 * Delay execution for `ms` milliseconds, cancellable via `abortSignal`.
 */
export function delayWithAbort(
  ms: number,
  abortSignal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
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
