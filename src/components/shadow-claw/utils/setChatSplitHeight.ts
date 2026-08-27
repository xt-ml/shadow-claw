import { clampChatSplitHeight } from "./clampChatSplitHeight.js";

export function setChatSplitHeight(
  shadow: ShadowRoot | null,
  px: number,
): void {
  const mainContent = shadow?.querySelector(".main-content");

  if (!(mainContent instanceof HTMLElement)) {
    return;
  }

  const clamped = clampChatSplitHeight(shadow, px);
  mainContent.style.setProperty("--chat-split-height", `${clamped}px`);
}
