import { resolveJsonPointer } from "./resolveJsonPointer.js";

import type { ChildList } from "../types.js";

/**
 * Resolve a `ChildList` to a concrete array of component IDs at render time.
 *
 * - Fixed array: returned as-is.
 * - Template `{ path, componentId }`: reads the list at `path` in the data
 *   model and generates synthetic IDs of the form `${componentId}_${index}`.
 *   The caller is responsible for making those components available in the
 *   surface (typically by cloning the template spec with per-item data).
 *
 * This implements spec §DataDrivenChildren / §ChildList including the `@index`
 * built-in: for each generated slot, the renderer injects `{ "@index": i }`
 * into a per-item data scope. The caller can access `@index` via
 * `{ "path": "/@index" }` in the template component.
 *
 * @param children  The raw ChildList from a component spec.
 * @param dataModel The current surface data model.
 */
export function resolveChildIds(
  children: ChildList,
  dataModel: Record<string, unknown>,
): string[] {
  let tmpl: { path: string; componentId: string };
  if (Array.isArray(children)) {
    // Gracefully handle agents that accidentally pass an array of templates or nested components
    if (
      children.length > 0 &&
      typeof children[0] === "object" &&
      children[0] !== null
    ) {
      const first = children[0] as any;
      if ("path" in first && "componentId" in first) {
        // Agent wrapped a template object in an array: [{"path": "...", "componentId": "..."}]
        // Fall through to the template handling below using the first element
        tmpl = first;
      } else if ("id" in first) {
        // Agent passed nested component objects: [{"id": "...", "component": "..."}]
        return children.map((c: any) => String(c.id));
      } else {
        // Agent passed nested component objects without IDs
        return [];
      }
    } else {
      return children as string[];
    }
  } else {
    tmpl = children;
  }

  // Template form: { path: "/items", componentId: "item_template" }
  const items = resolveJsonPointer(dataModel, tmpl.path);
  if (!Array.isArray(items)) {
    console.warn(
      `[a2ui] ChildList template path "${tmpl.path}" did not resolve to an array.`,
    );
    return [];
  }
  return items.map((_, i) => `${tmpl.componentId}_${i}`);
}
