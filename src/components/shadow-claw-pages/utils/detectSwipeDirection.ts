/**
 * Determines whether a mouse or touch drag gesture represents a horizontal page navigation swipe.
 */
export function detectSwipeDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startTime: number,
  endTime: number = Date.now(),
  minDistance: number = 50,
  maxTime: number = 600,
): "next" | "previous" | null {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const deltaTime = endTime - startTime;

  if (
    Math.abs(deltaX) >= minDistance &&
    Math.abs(deltaX) > Math.abs(deltaY) &&
    deltaTime <= maxTime
  ) {
    return deltaX < 0 ? "next" : "previous";
  }

  return null;
}
