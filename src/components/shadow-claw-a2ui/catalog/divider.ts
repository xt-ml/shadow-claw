import { applyWeight } from "./shared.js";

import type { DividerSpec } from "../../../ui/a2ui.js";
import type { SurfaceState } from "./types.js";

export function renderDivider(
  spec: DividerSpec,
  _surface: SurfaceState,
): HTMLElement {
  const el = document.createElement("hr");
  el.className = `a2ui__divider a2ui__divider--${spec.axis ?? "horizontal"}`;
  applyWeight(el, spec.weight);

  return el;
}
