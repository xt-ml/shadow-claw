import { applyWeight } from "./shared.js";

import type { RowSpec } from "../../../a2ui.js";
import type { SurfaceState, RenderContext } from "./types.js";

export function renderRow(
  spec: RowSpec,
  _: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent">,
): HTMLElement {
  const el = document.createElement("div");
  el.className = "a2ui__row";
  if (spec.justify) {
    el.classList.add(`a2ui__justify--${spec.justify}`);
  }

  if (spec.align) {
    el.classList.add(`a2ui__align--${spec.align}`);
  }

  applyWeight(el, spec.weight);

  for (const childId of spec.children) {
    const childEl = ctx.renderComponent(childId);
    if (childEl) {
      el.appendChild(childEl);
    }
  }

  return el;
}
