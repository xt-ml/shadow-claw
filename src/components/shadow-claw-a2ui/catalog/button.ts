import { applyWeight } from "./shared.js";

import type { ButtonSpec } from "../../../ui/a2ui.js";
import type { SurfaceState, RenderContext } from "./types.js";

export function renderButton(
  spec: ButtonSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent" | "dispatchAction">,
): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `a2ui__button a2ui__button--${spec.variant ?? "primary"}`;

  if (spec.checked) {
    btn.classList.add("a2ui__button--checked");
  }

  applyWeight(btn, spec.weight);

  if (spec.child && surface.components[spec.child]) {
    const labelEl = ctx.renderComponent(spec.child);
    if (labelEl) {
      labelEl.style.color = "inherit";
      btn.appendChild(labelEl);
    }
  } else {
    const fallbackText = (spec as any).text;
    if (typeof fallbackText === "string" && fallbackText) {
      btn.textContent = fallbackText;
    }
  }

  btn.addEventListener("click", () => {
    if (!spec.action) {
      return;
    }

    const actionId =
      spec.action.id ??
      (spec.action as any).event?.name ??
      (spec.action as any).name;
    if (actionId) {
      ctx.dispatchAction(actionId);
    }
  });

  return btn;
}
