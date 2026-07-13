import { applyWeight } from "./shared.js";
import { resolveDynamicString } from "../../../ui/a2ui.js";

import type { SliderSpec } from "../../../ui/a2ui.js";
import type { RenderContext, SurfaceState } from "../../types.js";

export function renderSlider(
  spec: SliderSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "updateDataModelPointer">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__slider";
  applyWeight(wrapper, spec.weight);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(spec.min ?? 0);
  input.max = String(spec.max ?? 100);
  if (spec.steps !== undefined) {
    input.step = String(spec.steps);
  }

  if (typeof spec.value === "number") {
    input.value = String(spec.value);
  } else if (spec.value !== undefined) {
    input.value = resolveDynamicString(spec.value, surface.dataModel);
  }

  input.addEventListener("input", () => {
    if (typeof spec.value === "object" && "$dataModel" in spec.value) {
      ctx.updateDataModelPointer(spec.value.$dataModel, Number(input.value));
    }
  });

  wrapper.appendChild(input);

  return wrapper;
}
