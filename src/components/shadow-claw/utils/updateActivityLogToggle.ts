export function updateActivityLogToggle(shadow: ShadowRoot | null, activityLogCollapsedOverride?: boolean): void {
  if (!shadow) {
    return;
  }

  const button = shadow.querySelector(".activity-log-toggle");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const autoCollapsed =
    typeof globalThis.matchMedia === "function"
      ? !globalThis.matchMedia("(min-width: 56rem) and (min-height: 401px)")
          .matches
      : false;

  const collapsed =
    typeof activityLogCollapsedOverride === "boolean"
      ? activityLogCollapsedOverride
      : autoCollapsed;

  button.setAttribute(
    "aria-label",
    collapsed ? "Show activity log" : "Hide activity log",
  );
  button.setAttribute(
    "title",
    collapsed ? "Show activity log" : "Hide activity log",
  );
  button.setAttribute("aria-pressed", String(collapsed));
}
