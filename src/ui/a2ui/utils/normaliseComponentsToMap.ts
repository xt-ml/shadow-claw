import type { A2UIComponentSpec } from "../types.js";

/**
 * Normalise a `components` array from a wire envelope into the keyed map used
 * by `SurfaceState` for O(1) lookup during render.
 *
 * Any component whose `id` is missing is skipped with a warning.
 */
export function normaliseComponentsToMap(
  components: A2UIComponentSpec[],
): Record<string, A2UIComponentSpec> {
  const map: Record<string, A2UIComponentSpec> = {};

  function walk(specs: any[]) {
    for (const spec of specs) {
      if (!spec || typeof spec !== "object") continue;

      if (spec.id) {
        map[spec.id] = spec;
      } else if (spec.component) {
        console.warn(
          "[a2ui] Component missing required 'id' field; skipped.",
          spec,
        );
      }

      // Check for nested children
      if (Array.isArray(spec.children)) {
        if (spec.children.length > 0 && typeof spec.children[0] === "object") {
          // Ensure it is not an array containing a template
          if (
            !("path" in spec.children[0] && "componentId" in spec.children[0])
          ) {
            walk(spec.children);
          }
        }
      }

      // Check for nested single child
      if (spec.child && typeof spec.child === "object") {
        walk([spec.child]);
      }

      // Check for nested tab children
      if (Array.isArray(spec.tabs)) {
        for (const tab of spec.tabs) {
          if (tab && typeof tab.child === "object") {
            walk([tab.child]);
          }
        }
      }
    }
  }

  walk(components);
  return map;
}
