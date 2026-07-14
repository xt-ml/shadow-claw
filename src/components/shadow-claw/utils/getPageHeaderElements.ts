import { PageHeaderLikeElement } from "../../types.js";

export function getPageHeaderElements(
  shadow: ShadowRoot | null,
): PageHeaderLikeElement[] {
  if (!shadow) {
    return [];
  }

  const containerSelectors = [
    "shadow-claw-chat",
    "shadow-claw-tasks",
    "shadow-claw-files",
    "shadow-claw-pages",
    "shadow-claw-settings",
    "shadow-claw-tools",
    "shadow-claw-channels",
  ];

  const headers: PageHeaderLikeElement[] = [];

  for (const selector of containerSelectors) {
    const container = shadow.querySelector(selector);
    if (!(container instanceof HTMLElement)) {
      continue;
    }

    const header = container.shadowRoot?.querySelector(
      "shadow-claw-page-header",
    );
    if (header instanceof HTMLElement) {
      headers.push(header as PageHeaderLikeElement);
    }
  }

  return headers;
}
