import type { TextVariant } from "../../../ui/a2ui.js";

export function variantToTag(variant: TextVariant): string {
  switch (variant) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
      return variant;
    default:
      return "span";
  }
}

export function applyWeight(el: HTMLElement, weight: number | undefined): void {
  if (weight !== undefined) {
    el.style.flexGrow = String(weight);
  }
}
