import { applyWeight } from "./shared.js";
import { resolveDynamicString } from "../../../a2ui.js";

import type { ChoicePickerSpec } from "../../../a2ui.js";
import type { SurfaceState, RenderContext } from "./types.js";

export function renderChoicePicker(
  spec: ChoicePickerSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "updateDataModelPointer">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__choicepicker";
  applyWeight(wrapper, spec.weight);

  const isMultiple = spec.variant === "multipleSelection";

  let boundKey: string | null = null;
  let initial: string[] = [];
  if (typeof spec.value === "object" && "$dataModel" in spec.value) {
    boundKey = spec.value.$dataModel.replace(/^\//, "");
    const current = surface.dataModel[boundKey];
    if (Array.isArray(current)) {
      initial = current.map(String);
    } else if (typeof current === "string") {
      initial = [current];
    }
  }

  spec.options.forEach((option) => {
    const id = `a2ui-choice-${surface.surfaceId}-${spec.id}-${option.value}`;
    const item = document.createElement("label");
    item.className = "a2ui__choice-item";

    const input = document.createElement("input");
    input.type = isMultiple ? "checkbox" : "radio";
    input.name = `a2ui-choice-${surface.surfaceId}-${spec.id}`;
    input.id = id;
    input.value = option.value;
    input.checked = initial.includes(option.value);

    input.addEventListener("change", () => {
      if (!boundKey) {
        return;
      }

      if (isMultiple) {
        const checkedValues = Array.from(
          wrapper.querySelectorAll<HTMLInputElement>("input:checked"),
        ).map((inputEl) => inputEl.value);
        ctx.updateDataModelPointer(`/${boundKey}`, checkedValues);
      } else {
        const selected =
          wrapper.querySelector<HTMLInputElement>("input:checked");
        ctx.updateDataModelPointer(
          `/${boundKey}`,
          selected ? selected.value : "",
        );
      }
    });

    const span = document.createElement("span");
    span.textContent = resolveDynamicString(option.label, surface.dataModel);

    item.append(input, span);
    wrapper.appendChild(item);
  });

  return wrapper;
}
