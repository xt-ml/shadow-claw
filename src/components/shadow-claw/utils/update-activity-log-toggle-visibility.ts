export function updateActivityLogToggleVisibility(
  shadow: ShadowRoot | null,
  currentPage: string,
  activityLogLength: number,
): void {
  if (!shadow) {
    return;
  }

  const button = shadow.querySelector(".activity-log-toggle");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.hidden = currentPage !== "chat" || activityLogLength === 0;
}
