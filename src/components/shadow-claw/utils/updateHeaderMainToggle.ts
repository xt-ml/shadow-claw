import { getActivePageHeaderElement } from "./getActivePageHeaderElement.js";

export function updateHeaderMainToggle(
  shadow: ShadowRoot | null,
  headerMainCollapsedOverride?: boolean | null,
): void {
  if (!shadow) {
    return;
  }

  const button = shadow.querySelector(".header-main-toggle");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const collapsed =
    typeof headerMainCollapsedOverride === "boolean"
      ? headerMainCollapsedOverride
      : (getActivePageHeaderElement(shadow)?.isMainCollapsed?.() ?? false);

  button.setAttribute(
    "aria-label",
    collapsed ? "Show action header" : "Hide action header",
  );

  button.setAttribute(
    "title",
    collapsed ? "Show action header" : "Hide action header",
  );

  button.setAttribute("aria-pressed", String(collapsed));
}
