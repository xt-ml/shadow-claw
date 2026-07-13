import { applyWeight, variantToTag } from "./shared.js";
import { resolveDynamicString } from "../../../ui/a2ui.js";

import type { TextSpec } from "../../../ui/a2ui.js";
import type { SurfaceState } from "../../types.js";

export function renderText(spec: TextSpec, surface: SurfaceState): HTMLElement {
  const variant = spec.variant ?? "body";
  const tag = variantToTag(variant);
  const el = document.createElement(tag);
  el.className = `a2ui__text a2ui__text--${variant}`;
  applyWeight(el, spec.weight);

  el.textContent = resolveDynamicString(spec.text, surface.dataModel);

  return el;
}
