import { coerceNumber } from "../../../utils/coerce.js";

/**
 * Parses and bounds an auto-refresh interval configuration value in seconds.
 * Returns an integer between 0 and 86400 (inclusive).
 */
export function parseAutoRefreshInterval(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") {
    return 0;
  }

  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return coerceNumber(parsed, 0, { min: 0, max: 86400 });
}
