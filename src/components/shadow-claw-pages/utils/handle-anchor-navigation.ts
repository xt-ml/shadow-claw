/**
 * Scrolls a target element or named anchor into view inside a rendered page container.
 * Returns true if an anchor target was found and scrolled to.
 */
export function handleAnchorNavigation(
  anchor: string,
  renderedContainer: HTMLElement | null,
): boolean {
  if (!renderedContainer || renderedContainer.hidden) {
    return false;
  }

  const id = anchor.replace(/^#/, "");
  const target =
    renderedContainer.querySelector(`[id="${id}"]`) ||
    renderedContainer.querySelector(`a[name="${id}"]`);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  return false;
}
