export type VisibilityStateAction = "render-and-timer" | "clear-timer" | "noop";

/**
 * Determines action to take when document visibility state changes.
 */
export function handleVisibilityStateChange(
  isHidden: boolean,
  isConnected: boolean,
  isTimerRunning: boolean,
): VisibilityStateAction {
  if (!isHidden && isConnected) {
    return "render-and-timer";
  }
  if (isHidden && isTimerRunning) {
    return "clear-timer";
  }
  return "noop";
}
