import { MIN_CHAT_SPLIT_HEIGHT_PX } from "../constants.js";

export function clampChatSplitHeight(
  shadow: ShadowRoot | null,
  px: number,
): number {
  const mainContent = shadow?.querySelector(".main-content");

  if (!(mainContent instanceof HTMLElement)) {
    return Math.max(MIN_CHAT_SPLIT_HEIGHT_PX, px);
  }

  const containerHeight =
    mainContent.getBoundingClientRect().height || window.innerHeight || 600;
  const maxByContainer = Math.max(
    MIN_CHAT_SPLIT_HEIGHT_PX,
    containerHeight - 100,
  );

  return Math.max(MIN_CHAT_SPLIT_HEIGHT_PX, Math.min(maxByContainer, px));
}
