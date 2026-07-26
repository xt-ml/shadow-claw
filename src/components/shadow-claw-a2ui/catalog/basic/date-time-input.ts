import { resolveDynamicString } from "../../../../ui/a2ui/utils/resolveDynamicString.js";
import { applyWeight } from "./shared.js";

import type { DateTimeInputSpec } from "../../../../ui/a2ui/types.js";
import type { RenderContext, SurfaceState } from "../../../types.js";

export function renderDateTimeInput(
  spec: DateTimeInputSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "updateDataModelPointer">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__datetime";
  applyWeight(wrapper, spec.weight);

  const inputId = `a2ui-datetime-${surface.surfaceId}-${spec.id}`;

  if (spec.label) {
    const labelEl = document.createElement("label");
    labelEl.className = "a2ui__datetime-label";
    labelEl.htmlFor = inputId;
    labelEl.textContent = resolveDynamicString(spec.label, surface.dataModel);
    wrapper.appendChild(labelEl);
  }

  const input = document.createElement("input");
  input.id = inputId;

  if (spec.enableDate && spec.enableTime) {
    input.type = "datetime-local";
  } else if (spec.enableDate) {
    input.type = "date";
  } else if (spec.enableTime) {
    input.type = "time";
  } else {
    input.type = "text";
  }

  // Resolve value: path ref, $dataModel ref, or static ISO 8601 string (spec §DateTimeInput)
  const rawValue = spec.value;
  if (rawValue && typeof rawValue === "object") {
    let key: string | null = null;
    if ("path" in rawValue) {
      // Spec-canonical
      key = (rawValue as { path: string }).path.replace(/^\//, "");
    } else if ("$dataModel" in rawValue) {
      // Deprecated
      key = (rawValue as { $dataModel: string }).$dataModel.replace(/^\//, "");
    }
    if (key !== null) {
      const current = surface.dataModel[key];
      if (typeof current === "string") {
        input.value = current;
      }
    }
  } else if (typeof rawValue === "string" && rawValue) {
    input.value = rawValue;
  }

  if (spec.min) {
    input.min = resolveDynamicString(spec.min, surface.dataModel);
  }

  if (spec.max) {
    input.max = resolveDynamicString(spec.max, surface.dataModel);
  }

  input.addEventListener("input", () => {
    if (rawValue && typeof rawValue === "object") {
      if ("path" in rawValue) {
        ctx.updateDataModelPointer(
          (rawValue as { path: string }).path,
          input.value,
        );
      } else if ("$dataModel" in rawValue) {
        ctx.updateDataModelPointer(
          (rawValue as { $dataModel: string }).$dataModel,
          input.value,
        );
      }
    }
  });

  wrapper.appendChild(input);

  return wrapper;
}
