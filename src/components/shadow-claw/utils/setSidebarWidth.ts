import { clampSidebarWidth } from "./clampSidebarWidth.js";

export function setSidebarWidth(shadow: ShadowRoot | null, px: number): void {
  const appBody = shadow?.querySelector(".app-body");

  if (!(appBody instanceof HTMLElement)) {
    return;
  }

  const clamped = clampSidebarWidth(shadow, px);
  appBody.style.setProperty("--sidebar-width", `${clamped}px`);
}
