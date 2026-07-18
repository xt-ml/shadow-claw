import { applyWeight } from "./shared.js";

import type { IconSpec } from "../../../ui/a2ui.js";
import type { SurfaceState } from "../../types.js";

export function renderIcon(
  spec: IconSpec,
  _surface: SurfaceState,
): HTMLElement {
  const span = document.createElement("span");
  span.className = "a2ui__icon material-symbols-outlined";

  if (typeof spec.name === "string") {
    span.dataset.iconName = spec.name;
    span.textContent = spec.name;
  } else if (
    spec.name &&
    typeof spec.name === "object" &&
    "path" in spec.name
  ) {
    const img = document.createElement("img");
    img.src = spec.name.path;
    img.alt = "";
    span.appendChild(img);
  }

  applyWeight(span, spec.weight);

  return span;
}
