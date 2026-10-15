import { getActivePageHeaderElement } from "./get-active-page-header-element.js";
import { syncPageHeaderMainVisibilityOverride } from "./sync-page-header-main-visibility-override.js";
import { updateHeaderMainToggle } from "./update-header-main-toggle.js";

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
