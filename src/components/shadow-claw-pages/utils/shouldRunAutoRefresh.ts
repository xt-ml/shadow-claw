/**
 * Determines whether the pages auto-refresh timer loop should be actively running.
 */
export function shouldRunAutoRefresh(
  intervalSec: number,
  isHidden: boolean,
  isConnected: boolean,
): boolean {
  return intervalSec > 0 && !isHidden && isConnected;
}
