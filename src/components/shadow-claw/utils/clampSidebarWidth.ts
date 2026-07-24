import { MAX_SIDEBAR_WIDTH_PX, MIN_SIDEBAR_WIDTH_PX } from "../shadow-claw.js";

export function clampSidebarWidth(
  shadow: ShadowRoot | null,
  px: number,
): number {
  const appBody = shadow?.querySelector(".app-body");

  if (!(appBody instanceof HTMLElement)) {
    return Math.max(MIN_SIDEBAR_WIDTH_PX, Math.min(MAX_SIDEBAR_WIDTH_PX, px));
  }

  const maxByContainer = Math.max(
    MIN_SIDEBAR_WIDTH_PX,
    appBody.getBoundingClientRect().width - 260,
  );

  return Math.max(
    MIN_SIDEBAR_WIDTH_PX,
    Math.min(Math.min(MAX_SIDEBAR_WIDTH_PX, maxByContainer), px),
  );
}
