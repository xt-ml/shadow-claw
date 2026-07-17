import { post } from "../../post.js";
import {
  A2UI_BASIC_CATALOG_ID,
  A2UI_MINIMAL_CATALOG_ID,
} from "../../../ui/a2ui.js";
import type { A2UIEnvelope } from "../../../ui/a2ui.js";

export function executeRenderComponent(
  input: Record<string, any>,
  groupId: string,
): string {
  const { action, surfaceId } = input;

  if (input.components && typeof input.components === "object") {
    for (const key of Object.keys(input.components)) {
      const spec = input.components[key];
      if (
        spec &&
        typeof spec === "object" &&
        "properties" in spec &&
        typeof spec.properties === "object"
      ) {
        input.components[key] = { ...spec, ...(spec.properties as any) };

        delete input.components[key].properties;
      }
    }
  }

  if (!surfaceId || typeof surfaceId !== "string") {
    return "Error: render_component requires a surfaceId string.";
  }

  let envelope: A2UIEnvelope;

  switch (action) {
    case "createSurface": {
      if (!input.rootComponentId) {
        return "Error: createSurface requires rootComponentId.";
      }

      if (!input.components || typeof input.components !== "object") {
        return "Error: createSurface requires a components map.";
      }

      const resolvedCatalogId =
        input.catalogId === A2UI_BASIC_CATALOG_ID ||
        String(input.catalogId ?? "").toLowerCase() === "basic"
          ? A2UI_BASIC_CATALOG_ID
          : A2UI_MINIMAL_CATALOG_ID;

      envelope = {
        catalogId: resolvedCatalogId,
        components: input.components,
        dataModel: input.dataModel,
        rootComponentId: input.rootComponentId,
        surfaceId,
        type: "createSurface",
      };

      break;
    }

    case "updateComponents": {
      if (!input.components || typeof input.components !== "object") {
        return "Error: updateComponents requires a components map.";
      }

      envelope = {
        components: input.components,
        surfaceId,
        type: "updateComponents",
      };

      break;
    }

    case "updateDataModel": {
      if (!input.patches || typeof input.patches !== "object") {
        return "Error: updateDataModel requires a patches object (JSON Pointer map).";
      }

      envelope = {
        patches: input.patches,
        surfaceId,
        type: "updateDataModel",
      };

      break;
    }

    case "deleteSurface": {
      envelope = {
        surfaceId,
        type: "deleteSurface",
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
