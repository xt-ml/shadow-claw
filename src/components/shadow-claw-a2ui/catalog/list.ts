import { applyWeight } from "./shared.js";

import type { ListSpec } from "../../../a2ui.js";
import type { SurfaceState, RenderContext } from "./types.js";

export function renderList(
  spec: ListSpec,
  _: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent">,
): HTMLElement {
  const el = document.createElement("div");
  el.className = `a2ui__list a2ui__list--${spec.direction ?? "vertical"}`;
  applyWeight(el, spec.weight);

  for (const childId of spec.children) {
    const childEl = ctx.renderComponent(childId);
    if (childEl) {
      const item = document.createElement("div");
      item.className = "a2ui__list-item";
      item.appendChild(childEl);
      el.appendChild(item);
    }
  }

  return el;
}
