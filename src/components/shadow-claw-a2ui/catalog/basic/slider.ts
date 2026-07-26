import { resolveDynamicString } from "../../../../ui/a2ui/utils/resolveDynamicString.js";
import { applyWeight } from "./shared.js";

import type { SliderSpec } from "../../../../ui/a2ui/types.js";
import type { RenderContext, SurfaceState } from "../../../types.js";

export function renderSlider(
  spec: SliderSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "updateDataModelPointer">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__slider";
  applyWeight(wrapper, spec.weight);

  const inputId = `a2ui-slider-${surface.surfaceId}-${spec.id}`;

  if (spec.label) {
    const labelEl = document.createElement("label");
    labelEl.className = "a2ui__slider-label";
    labelEl.htmlFor = inputId;
    labelEl.textContent = resolveDynamicString(spec.label, surface.dataModel);
    wrapper.appendChild(labelEl);
  }

  const input = document.createElement("input");
  input.type = "range";
  input.id = inputId;
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
    if (typeof spec.value === "object" && "path" in spec.value) {
      // Spec-canonical: { "path": "/key" }
      ctx.updateDataModelPointer(
        (spec.value as { path: string }).path,
        Number(input.value),
      );
    } else if (typeof spec.value === "object" && "$dataModel" in spec.value) {
      // Deprecated: { "$dataModel": "/key" }
      ctx.updateDataModelPointer(
        (spec.value as { $dataModel: string }).$dataModel,
        Number(input.value),
      );
    }
  });

  wrapper.appendChild(input);

  return wrapper;
}
