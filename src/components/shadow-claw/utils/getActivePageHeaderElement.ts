import { PageHeaderLikeElement } from "../../types.js";

export function getActivePageHeaderElement(
  shadow: ShadowRoot | null,
): PageHeaderLikeElement | null {
  if (!shadow) {
    return null;
  }

  const activePage = shadow.querySelector(".page.active");
  if (!(activePage instanceof HTMLElement)) {
    return null;
  }

  const pageContainer = activePage.querySelector(
    "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files, shadow-claw-pages, shadow-claw-settings, shadow-claw-tools, shadow-claw-channels",
  );
  if (!(pageContainer instanceof HTMLElement)) {
    return null;
  }

  const header = pageContainer.shadowRoot?.querySelector(
    "shadow-claw-page-header",
  );

  return header instanceof HTMLElement
    ? (header as PageHeaderLikeElement)
    : null;
}
