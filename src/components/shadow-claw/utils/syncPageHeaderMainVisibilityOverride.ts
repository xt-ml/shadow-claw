import { getPageHeaderElements } from "./getPageHeaderElements.js";

export function syncPageHeaderMainVisibilityOverride(
  shadow: ShadowRoot | null,
  headerMainCollapsedOverride: boolean | null,
) {
  if (!shadow) {
    return;
  }

  for (const header of getPageHeaderElements(shadow)) {
    header.setMainCollapsedOverride?.(headerMainCollapsedOverride);
  }
}
