/**
 * Determines whether a keydown event should trigger previous or next page navigation.
 */
export function shouldHandleKeyDownNavigation(
  event: KeyboardEvent,
  isSuppressed: boolean,
): "next" | "previous" | null {
  if (isSuppressed) {
    return null;
  }

  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return null;
  }

  if (event.ctrlKey || event.altKey || event.metaKey) {
    return null;
  }

  return event.key === "ArrowLeft" ? "previous" : "next";
}
