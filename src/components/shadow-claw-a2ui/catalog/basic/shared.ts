import { resolveJsonPointer } from "../../../../ui/a2ui/utils/resolveJsonPointer.js";

import type { ChildList, TextVariant } from "../../../../ui/a2ui/types.js";
import type { RenderContext, SurfaceState } from "../../../types.js";

export { resolveChildIds } from "../../../../ui/a2ui/utils/resolveChildIds.js";

export function renderChildrenList(
  children: ChildList,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "renderComponent">,
  appendFn: (childEl: HTMLElement) => void,
): void {
  let tmpl: { path: string; componentId: string };

  if (Array.isArray(children)) {
    if (
      children.length > 0 &&
      typeof children[0] === "object" &&
      children[0] !== null
    ) {
      const first = children[0] as any;
      if ("path" in first && "componentId" in first) {
        tmpl = first;
      } else if ("id" in first) {
        for (const c of children) {
          const el = ctx.renderComponent(String((c as any).id));
          if (el) appendFn(el);
        }
        return;
      } else {
        return;
      }
    } else {
      for (const id of children) {
        const el = ctx.renderComponent(String(id));
        if (el) appendFn(el);
      }
      return;
    }
  } else {
    tmpl = children;
  }

  const items = resolveJsonPointer(surface.dataModel, tmpl.path);
  if (!Array.isArray(items)) {
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const el = ctx.renderComponent(tmpl.componentId, {
      arrayPath: tmpl.path,
      index: i,
      itemValue: items[i],
    });
    if (el) appendFn(el);
  }
}

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
