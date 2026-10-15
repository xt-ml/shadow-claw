export interface TouchState {
  touchStartX: number;
  touchStartY: number;
  touchStartTime: number;
}

/**
 * Handles touchstart event state updates.
 */
export function handleTouchStartGesture(
  event: TouchEvent,
  isSuppressed: boolean,
  now: number = Date.now(),
): TouchState | null {
  if (isSuppressed) {
    return { touchStartX: 0, touchStartY: 0, touchStartTime: 0 };
  }

  if (event.touches && event.touches.length === 1) {
    return {
      touchStartX: event.touches[0].clientX,
      touchStartY: event.touches[0].clientY,
      touchStartTime: now,
    };
  }

  return null;
}
