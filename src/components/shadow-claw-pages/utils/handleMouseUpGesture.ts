import { detectSwipeDirection } from "./detectSwipeDirection.js";
import type { MouseState } from "./handleMouseDownGesture.js";

/**
 * Evaluates mouseup event swipe gesture.
 */
export function handleMouseUpGesture(
  event: MouseEvent,
  mouseState: MouseState,
  isSuppressed: boolean,
  hasSelection: boolean,
  now: number = Date.now(),
): "previous" | "next" | null {
  if (!mouseState.isMouseDown || isSuppressed || hasSelection) {
    return null;
  }

  return detectSwipeDirection(
    mouseState.mouseStartX,
    mouseState.mouseStartY,
    event.clientX,
    event.clientY,
    mouseState.mouseStartTime,
    now,
  );
}
