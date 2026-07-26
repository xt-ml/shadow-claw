import { resolveDynamicString } from "../../../../ui/a2ui/utils/resolveDynamicString.js";

import type { CheckBoxSpec } from "../../../../ui/a2ui/types.js";
import type { RenderContext, SurfaceState } from "../../../types.js";

export function renderCheckBox(
  spec: CheckBoxSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "dispatchAction" | "updateDataModelPointer">,
): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "a2ui__checkbox";

  const input = document.createElement("input");
  input.type = "checkbox";

  if (typeof spec.value === "object" && "path" in spec.value) {
    // Spec-canonical: { "path": "/key" }
    const key = (spec.value as { path: string }).path.replace(/^\//, "");
    input.checked = Boolean(surface.dataModel[key]);
  } else if (typeof spec.value === "object" && "$dataModel" in spec.value) {
    // Deprecated: { "$dataModel": "/key" }
    const key = (spec.value as { $dataModel: string }).$dataModel.replace(
      /^\//,
      "",
    );
    input.checked = Boolean(surface.dataModel[key]);
  } else if (typeof spec.value === "boolean") {
    input.checked = spec.value;
  }

  input.addEventListener("change", () => {
    if (typeof spec.value === "object" && "path" in spec.value) {
      ctx.updateDataModelPointer(
        (spec.value as { path: string }).path,
        input.checked,
      );
    } else if (typeof spec.value === "object" && "$dataModel" in spec.value) {
      ctx.updateDataModelPointer(
        (spec.value as { $dataModel: string }).$dataModel,
        input.checked,
      );
    }

    // Spec §actions: use event.name; fall back to deprecated id.
    const actionId =
      (spec as any).action?.event?.name ?? (spec as any).action?.id;
    if (actionId) {
      ctx.dispatchAction(actionId);
    }
  });

  const label = document.createElement("span");
  label.className = "a2ui__checkbox-label";
  label.textContent = resolveDynamicString(spec.label, surface.dataModel);

  wrapper.append(input, label);

  return wrapper;
}
