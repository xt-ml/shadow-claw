export function syncActivityLogVisibilityOverride(
  shadow: ShadowRoot | null,
  activityLogCollapsedOverride: boolean | null,
) {
  if (!shadow) {
    return;
  }

  const chat = shadow.querySelector("shadow-claw-chat") as any;
  if (chat && typeof chat.setActivityLogCollapsedOverride === "function") {
    chat.setActivityLogCollapsedOverride(activityLogCollapsedOverride);
  }
}
