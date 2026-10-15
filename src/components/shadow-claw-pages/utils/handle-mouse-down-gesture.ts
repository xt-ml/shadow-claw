export interface MouseState {
  mouseStartX: number;
  mouseStartY: number;
  mouseStartTime: number;
  isMouseDown: boolean;
}

/**
 * Handles mousedown event state updates.
 */
export function handleMouseDownGesture(
  event: MouseEvent,
  isSuppressed: boolean,
  now: number = Date.now(),
): MouseState {
  if (event.button !== 0 || isSuppressed) {
    return {
      mouseStartX: 0,
      mouseStartY: 0,
      mouseStartTime: 0,
      isMouseDown: false,
    };
  }

  return {
    mouseStartX: event.clientX,
    mouseStartY: event.clientY,
    mouseStartTime: now,
    isMouseDown: true,
  };
}
