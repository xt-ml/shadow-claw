/**
 * Calculate exponential backoff delay in milliseconds for network retry attempts.
 * Clamped between 1,000ms and 15,000ms.
 */
export function backoffDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, attempt);
  return Math.min(15_000, 1_000 * 2 ** (safeAttempt - 1));
}
