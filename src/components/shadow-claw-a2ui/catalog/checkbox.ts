import { resolveDynamicString } from "../../../a2ui.js";

import type { CheckBoxSpec } from "../../../a2ui.js";
import type { SurfaceState, RenderContext } from "./types.js";

export function renderCheckBox(
  spec: CheckBoxSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "dispatchAction" | "updateDataModelPointer">,
): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "a2ui__checkbox";

  const input = document.createElement("input");
  input.type = "checkbox";

  if (typeof spec.value === "object" && "$dataModel" in spec.value) {
    const key = spec.value.$dataModel.replace(/^\//, "");
    input.checked = Boolean(surface.dataModel[key]);
  } else if (typeof spec.value === "boolean") {
    input.checked = spec.value;
  }

  input.addEventListener("change", () => {
    if (typeof spec.value === "object" && "$dataModel" in spec.value) {
      ctx.updateDataModelPointer(spec.value.$dataModel, input.checked);
    }

    if ((spec as any).action?.id) {
      ctx.dispatchAction((spec as any).action.id);
    }
  });

  const label = document.createElement("span");
  label.className = "a2ui__checkbox-label";
  label.textContent = resolveDynamicString(spec.label, surface.dataModel);

  wrapper.append(input, label);

  return wrapper;
}
