import { syncActivityLogVisibilityOverride } from "./sync-activity-log-visibility-override.js";
import { updateActivityLogToggle } from "./update-activity-log-toggle.js";

import type { ShadowClaw } from "../shadow-claw.js";

export function toggleActivityLogVisibility(shadowClaw: ShadowClaw) {
  const autoCollapsed =
    typeof globalThis.matchMedia === "function"
      ? !globalThis.matchMedia("(min-width: 56rem) and (min-height: 401px)")
          .matches
      : false;

  const currentCollapsed =
    typeof shadowClaw.activityLogCollapsedOverride === "boolean"
      ? shadowClaw.activityLogCollapsedOverride
      : autoCollapsed;

  shadowClaw.activityLogCollapsedOverride = !currentCollapsed;
  syncActivityLogVisibilityOverride(
    shadowClaw.shadowRoot,
    shadowClaw.activityLogCollapsedOverride,
  );

  updateActivityLogToggle(
    shadowClaw.shadowRoot,
    shadowClaw.activityLogCollapsedOverride,
  );
}
