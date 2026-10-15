import { detectSwipeDirection } from "./detect-swipe-direction.js";
import type { TouchState } from "./handle-touch-start-gesture.js";

/**
 * Evaluates touchend event swipe gesture.
 */
export function handleTouchEndGesture(
  event: TouchEvent,
  touchState: TouchState,
  isSuppressed: boolean,
  now: number = Date.now(),
): "previous" | "next" | null {
  if (!touchState.touchStartTime || isSuppressed) {
    return null;
  }

  if (event.changedTouches && event.changedTouches.length === 1) {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;

    return detectSwipeDirection(
      touchState.touchStartX,
      touchState.touchStartY,
      touchEndX,
      touchEndY,
      touchState.touchStartTime,
      now,
    );
  }

  return null;
}
