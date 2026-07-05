import { applyWeight } from "./shared.js";
import { resolveDynamicString } from "../../../ui/a2ui.js";

import type { DateTimeInputSpec } from "../../../ui/a2ui.js";
import type { RenderContext, SurfaceState } from "./types.js";

export function renderDateTimeInput(
  spec: DateTimeInputSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "updateDataModelPointer">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__datetime";
  applyWeight(wrapper, spec.weight);

  const input = document.createElement("input");
  if (spec.enableDate && spec.enableTime) {
    input.type = "datetime-local";
  } else if (spec.enableDate) {
    input.type = "date";
  } else if (spec.enableTime) {
    input.type = "time";
  } else {
    input.type = "text";
  }

  if (
    spec.value &&
    typeof spec.value === "object" &&
    "$dataModel" in spec.value
  ) {
    const key = spec.value.$dataModel.replace(/^\//, "");
    const current = surface.dataModel[key];
    if (typeof current === "string") {
      input.value = current;
    }
  }

  if (spec.min) {
    input.min = resolveDynamicString(spec.min, surface.dataModel);
  }

  if (spec.max) {
    input.max = resolveDynamicString(spec.max, surface.dataModel);
  }

  input.addEventListener("input", () => {
    if (
      spec.value &&
      typeof spec.value === "object" &&
      "$dataModel" in spec.value
    ) {
      ctx.updateDataModelPointer(spec.value.$dataModel, input.value);
    }
  });

  wrapper.appendChild(input);

  return wrapper;
}
