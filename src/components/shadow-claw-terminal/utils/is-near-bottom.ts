import { AUTO_SCROLL_BOTTOM_THRESHOLD_PX } from "../shadow-claw-terminal.js";

export function isNearBottom(screen: HTMLElement): boolean {
  const distanceToBottom =
    screen.scrollHeight - (screen.scrollTop + screen.clientHeight);

  return distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
}
