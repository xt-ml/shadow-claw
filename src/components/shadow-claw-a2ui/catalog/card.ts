import { applyWeight } from "./shared.js";

import type { CardSpec } from "../../../ui/a2ui.js";
import type { SurfaceState, RenderContext } from "../../types.js";

export function renderCard(
  spec: CardSpec,
  _: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__card";
  applyWeight(wrapper, spec.weight);

  const childEl = ctx.renderComponent(spec.child);
  if (childEl) {
    wrapper.appendChild(childEl);
  }

  return wrapper;
}
