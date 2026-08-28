/**
 * Parses and bounds an auto-refresh interval configuration value in seconds.
 * Returns an integer between 0 and 86400 (inclusive).
 */
export function parseAutoRefreshInterval(value: unknown): number {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return Math.min(parsed, 86400);
    }
  }
  return 0;
}
