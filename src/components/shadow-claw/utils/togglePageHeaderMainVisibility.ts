import { getActivePageHeaderElement } from "./getActivePageHeaderElement.js";
import { syncPageHeaderMainVisibilityOverride } from "./syncPageHeaderMainVisibilityOverride.js";
import { updateHeaderMainToggle } from "./updateHeaderMainToggle.js";

import type { ShadowClaw } from "../shadow-claw.js";

export function togglePageHeaderMainVisibility(shadowClaw: ShadowClaw) {
  const currentCollapsed =
    typeof shadowClaw.headerMainCollapsedOverride === "boolean"
      ? shadowClaw.headerMainCollapsedOverride
      : (getActivePageHeaderElement(
          shadowClaw.shadowRoot,
        )?.isMainCollapsed?.() ?? false);

  shadowClaw.headerMainCollapsedOverride = !currentCollapsed;
  syncPageHeaderMainVisibilityOverride(
    shadowClaw.shadowRoot,
    shadowClaw.headerMainCollapsedOverride,
  );

  updateHeaderMainToggle(
    shadowClaw.shadowRoot,
    shadowClaw.headerMainCollapsedOverride,
  );
}
