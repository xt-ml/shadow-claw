import type { ShadowClaw } from "../shadow-claw.js";

export function applyPagesSidebarVisibility(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
) {
  if (!shadow) {
    return;
  }

  const pagesNavItem = shadow.querySelector(
    '.nav-item[data-page="pages"]',
  ) as HTMLElement | null;

  if (!pagesNavItem) {
    return;
  }

  const isHidden = shadowClaw.pagesSidebarHidden;
  pagesNavItem.hidden = isHidden;
  pagesNavItem.setAttribute("aria-hidden", String(isHidden));
}
