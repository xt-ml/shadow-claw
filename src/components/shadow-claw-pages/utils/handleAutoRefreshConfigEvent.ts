import { parseAutoRefreshInterval } from "./parseAutoRefreshInterval.js";

/**
 * Extracts and parses auto-refresh interval from configuration event detail.
 */
export function handleAutoRefreshConfigEvent(event: Event): number | null {
  const detail = (event as CustomEvent).detail;
  if (detail && typeof detail.interval !== "undefined") {
    return parseAutoRefreshInterval(detail.interval);
  }
  return null;
}
