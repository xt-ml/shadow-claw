import { applyWeight } from "./shared.js";
import { resolveDynamicString } from "../../../a2ui.js";

import type { TextFieldSpec } from "../../../a2ui.js";
import type { SurfaceState, RenderContext } from "./types.js";

export function renderTextField(
  spec: TextFieldSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "updateDataModelKey">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__field";
  applyWeight(wrapper, spec.weight);

  const label = document.createElement("label");
  label.className = "a2ui__field-label";
  label.textContent = resolveDynamicString(spec.label, surface.dataModel);

  const isLongText = spec.variant === "longText";
  let input: HTMLInputElement | HTMLTextAreaElement;

  if (isLongText) {
    const ta = document.createElement("textarea");
    ta.className = "a2ui__field-textarea";
    ta.rows = 3;
    if (spec.value !== undefined) {
      ta.value = resolveDynamicString(spec.value, surface.dataModel);
    }

    ta.addEventListener("input", () => {
      ctx.updateDataModelKey(spec, ta.value);
    });
    input = ta;
  } else {
    const inp = document.createElement("input");
    inp.className = "a2ui__field-input";
    inp.type =
      spec.variant === "number"
        ? "number"
        : spec.variant === "obscured"
          ? "password"
          : "text";
    if (spec.value !== undefined) {
      inp.value = resolveDynamicString(spec.value, surface.dataModel);
    }

    if (spec.validationRegexp) {
      inp.pattern = spec.validationRegexp;
    }

    inp.addEventListener("input", () => {
      ctx.updateDataModelKey(spec, inp.value);
    });
    input = inp;
  }

  const inputId = `a2ui-field-${surface.surfaceId}-${spec.id}`;
  input.id = inputId;
  label.htmlFor = inputId;

  wrapper.append(label, input);

  return wrapper;
}
