import { applyWeight, renderChildrenList } from "./shared.js";

import type { RowSpec } from "../../../../ui/a2ui/types.js";
import type { RenderContext, SurfaceState } from "../../../types.js";

export function renderRow(
  spec: RowSpec,
  surface: SurfaceState,
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

  renderChildrenList(spec.children, surface, ctx, (childEl) => {
    el.appendChild(childEl);
  });

  return el;
}
