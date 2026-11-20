import {
  MIN_SIDEBAR_WIDTH_PX,
  SIDEBAR_COLLAPSED_WIDTH_PX,
} from "../constants.js";
import { clampSidebarWidth } from "./clamp-sidebar-width.js";

export function setSidebarWidth(shadow: ShadowRoot | null, px: number): void {
  const appBody = shadow?.querySelector(".app-body");

  if (!(appBody instanceof HTMLElement)) {
    return;
  }

  const isCollapsed = !Number.isFinite(px) || px < MIN_SIDEBAR_WIDTH_PX;
  const effectiveWidth = isCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH_PX
    : clampSidebarWidth(shadow, px);

  appBody.style.setProperty("--sidebar-width", `${effectiveWidth}px`);
  appBody.classList.toggle("sidebar-collapsed", isCollapsed);

  const sidebar = shadow?.querySelector(".sidebar");
  if (sidebar instanceof HTMLElement) {
    sidebar.classList.toggle("collapsed", isCollapsed);
    sidebar.dataset.sidebarMode = isCollapsed ? "collapsed" : "expanded";
    if (isCollapsed && !sidebar.classList.contains("open")) {
      sidebar.setAttribute("aria-hidden", "true");
      sidebar.toggleAttribute("inert", true);
    } else {
      sidebar.removeAttribute("aria-hidden");
      sidebar.toggleAttribute("inert", false);
    }
  }
}
