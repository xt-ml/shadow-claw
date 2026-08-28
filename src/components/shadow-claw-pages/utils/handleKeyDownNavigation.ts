import { isNavigationSuppressed } from "./isNavigationSuppressed.js";
import { shouldHandleKeyDownNavigation } from "./shouldHandleKeyDownNavigation.js";

/**
 * Handles keydown keyboard navigation for Pages.
 */
export function handleKeyDownNavigation(
  event: KeyboardEvent,
  isConnected: boolean,
  shadowRoot: ShadowRoot | null,
  onNavigate: (direction: "previous" | "next") => void,
): void {
  if (!isConnected) {
    return;
  }

  const activeEl = shadowRoot?.activeElement || document.activeElement;
  const target = (event.target as HTMLElement) || null;
  const suppressed =
    isNavigationSuppressed(event, target) ||
    isNavigationSuppressed(undefined, activeEl);

  const direction = shouldHandleKeyDownNavigation(event, suppressed);
  if (!direction) {
    return;
  }

  event.preventDefault();
  onNavigate(direction);
}
