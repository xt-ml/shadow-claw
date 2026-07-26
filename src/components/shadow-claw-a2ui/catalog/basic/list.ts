import { applyWeight, renderChildrenList } from "./shared.js";

import type { ListSpec } from "../../../../ui/a2ui/types.js";
import type { RenderContext, SurfaceState } from "../../../types.js";

export function renderList(
  spec: ListSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent">,
): HTMLElement {
  const el = document.createElement("div");
  el.className = `a2ui__list a2ui__list--${spec.direction ?? "vertical"}`;
  applyWeight(el, spec.weight);

  renderChildrenList(spec.children, surface, ctx, (childEl) => {
    const item = document.createElement("div");
    item.className = "a2ui__list-item";
    item.appendChild(childEl);
    el.appendChild(item);
  });

  return el;
}
