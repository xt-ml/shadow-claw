import { isNavigationSuppressed } from "./isNavigationSuppressed.js";
import { shouldHandleKeyDownNavigation } from "./shouldHandleKeyDownNavigation.js";

/**
 * Default throttle interval in milliseconds for keyboard navigation.
 */
export const KEY_NAVIGATION_THROTTLE_MS = 300;

export interface KeyNavigationState {
  lastNavigationTime: number;
  lastDirection: "previous" | "next" | null;
}

/**
 * Handles keydown keyboard navigation for Pages with throttling to prevent
 * rapid page transitions when holding down navigation keys.
 */
export function handleKeyDownNavigation(
  event: KeyboardEvent,
  isConnected: boolean,
  shadowRoot: ShadowRoot | null,
  onNavigate: (direction: "previous" | "next") => void,
  state?: KeyNavigationState,
  throttleMs: number = KEY_NAVIGATION_THROTTLE_MS,
  now: number = Date.now(),
): KeyNavigationState {
  const navState = state ?? { lastNavigationTime: 0, lastDirection: null };

  if (!isConnected) {
    return navState;
  }

  const activeEl = shadowRoot?.activeElement || document.activeElement;
  const target = (event.target as HTMLElement) || null;
  const suppressed =
    isNavigationSuppressed(event, target) ||
    isNavigationSuppressed(undefined, activeEl);

  const direction = shouldHandleKeyDownNavigation(event, suppressed);
  if (!direction) {
    return navState;
  }

  event.preventDefault();

  if (
    navState.lastDirection === direction &&
    now - navState.lastNavigationTime < throttleMs
  ) {
    return navState;
  }

  navState.lastNavigationTime = now;
  navState.lastDirection = direction;
  onNavigate(direction);

  return navState;
}
