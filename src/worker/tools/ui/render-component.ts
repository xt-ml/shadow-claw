import { post } from "../../utils/post.js";

import { A2UI_BASIC_CATALOG_ID } from "../../../ui/a2ui/types.js";

import type { A2UIEnvelope } from "../../../ui/a2ui/types.js";

/**
 * Normalise the `components` input from the agent.
 *
 * Accepts two forms for backward compatibility:
 * 1. **Array** (spec-compliant): `[{id:"root",component:"Column",...}, ...]`
 * 2. **Map** (deprecated): `{"root":{component:"Column",...}, ...}`
 *
 * Both are normalised to a spec-compliant array where each object has an `id`.
 * Also applies the LLM-workaround that flattens any nested `properties` keys.
 */
function normaliseComponents(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) {
    return raw.map((spec: Record<string, unknown>) => {
      if (
        spec &&
        typeof spec === "object" &&
        "properties" in spec &&
        typeof spec["properties"] === "object"
      ) {
        const { properties, ...rest } = spec;
        return { ...rest, ...(properties as Record<string, unknown>) };
      }
      return spec;
    });
  }

  if (raw && typeof raw === "object") {
    // Deprecated map form: convert to array, stamping the key as `id`.
    return Object.entries(raw as Record<string, Record<string, unknown>>).map(
      ([id, spec]) => {
        let flat = spec;
        if (
          flat &&
          typeof flat === "object" &&
          "properties" in flat &&
          typeof flat["properties"] === "object"
        ) {
          const { properties, ...rest } = flat;
          flat = { ...rest, ...(properties as Record<string, unknown>) };
        }
        return { id, ...flat };
      },
    );
  }

  return [];
}

export function executeRenderComponent(
  input: Record<string, any>,
  groupId: string,
): string {
  const { action, surfaceId } = input;

  if (!surfaceId || typeof surfaceId !== "string") {
    return "Error: render_component requires a surfaceId string.";
  }

  let envelope: A2UIEnvelope;

  switch (action) {
    case "createSurface": {
      if (!input.components) {
        return "Error: createSurface requires a components array (or legacy map).";
      }

      const components = normaliseComponents(input.components);

      // Validate that a root component exists.
      const hasRoot = components.some((c) => c["id"] === "root");
      if (!hasRoot) {
        return (
          'Error: createSurface requires a component with id "root". ' +
          'One component in the array must have {"id":"root"} to serve as the tree root.'
        );
      }

      envelope = {
        version: "v1.0",
        type: "createSurface",
        surfaceId,
        catalogId: A2UI_BASIC_CATALOG_ID,
        components: components as any,
        dataModel: input.dataModel,
        sendDataModel: input.sendDataModel,
        surfaceProperties: input.surfaceProperties,
      };

      break;
    }

    case "updateComponents": {
      if (!input.components) {
        return "Error: updateComponents requires a components array (or legacy map).";
      }

      const components = normaliseComponents(input.components);

      envelope = {
        version: "v1.0",
        type: "updateComponents",
        surfaceId,
        components: components as any,
      };

      break;
    }

    case "updateDataModel": {
      // Accept both new spec form (path + value) and deprecated patches map.
      if (input.patches && typeof input.patches === "object") {
        // Deprecated: convert first entry to path/value for each key.
        // We send one message per patch key so the spec envelope is honoured.
        const entries = Object.entries(
          input.patches as Record<string, unknown>,
        );
        if (entries.length === 0) {
          return "Error: updateDataModel patches object is empty.";
        }

        // Post all but the first entry as separate envelopes.
        for (let i = 1; i < entries.length; i++) {
          const [p, v] = entries[i];
          post({
            payload: {
              groupId,
              envelope: {
                version: "v1.0" as const,
                type: "updateDataModel" as const,
                surfaceId,
                path: p,
                value: v,
              },
            },
            type: "render-component",
          });
        }

        const [firstPath, firstValue] = entries[0];
        envelope = {
          version: "v1.0",
          type: "updateDataModel",
          surfaceId,
          path: firstPath,
          value: firstValue,
        };
      } else {
        // Spec-compliant: path + value
        envelope = {
          version: "v1.0",
          type: "updateDataModel",
          surfaceId,
          path: input.path,
          value: input.value,
        };
      }

      break;
    }

    case "deleteSurface": {
      envelope = {
        version: "v1.0",
        type: "deleteSurface",
        surfaceId,
      };

      break;
    }

    default:
      return `Error: Unknown render_component action "${action}". Valid: createSurface, updateComponents, updateDataModel, deleteSurface.`;
  }

  post({
    payload: { groupId, envelope },
    type: "render-component",
  });

  return `A2UI surface "${surfaceId}" rendered (action: ${action}).`;
}
