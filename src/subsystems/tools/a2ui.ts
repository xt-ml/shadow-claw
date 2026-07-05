import type { ToolDefinition } from "./types.js";
import {
  A2UI_MINIMAL_CATALOG_ID,
  A2UI_BASIC_CATALOG_ID,
  A2UI_AVAILABLE_CATALOGS,
} from "../../ui/a2ui.js";

/**
 * Export available A2UI catalogs for agent/tool discovery.
 * Agents can call render_component with any of these catalog IDs.
 */
export const availableCatalogs = {
  minimal: A2UI_MINIMAL_CATALOG_ID,
  basic: A2UI_BASIC_CATALOG_ID,
  all: A2UI_AVAILABLE_CATALOGS,
};

export const list_components: ToolDefinition = {
  name: "list_components",
  description:
    "List all available A2UI components in the Minimal and Basic catalogs. " +
    "Returns a human-readable reference of component types, their required/optional properties, " +
    "and an example showing how to compose them. Call this before render_component to understand " +
    "what components are available and how to structure the input correctly. For full Basic catalog " +
    "schema details see the A2UI Basic Catalog (A2UI_BASIC_CATALOG_ID).",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const render_component: ToolDefinition = {
  name: "render_component",
  description:
    "Render an interactive A2UI UI surface in the peer's chat window using the Minimal or Basic catalog. " +
    "The surface appears inline in the conversation on the remote peer's side (or locally if no peer). " +
    "Minimal components: Text, Row, Column, Button, TextField. " +
    "Basic components: Image, Icon, Video, AudioPlayer, List, Card, Tabs, Modal, Divider, CheckBox, ChoicePicker, Slider, DateTimeInput. " +
    "Use list_components first to understand available components and their schemas. " +
    "All user input (button clicks, form field changes) automatically updates the dataModel and is routed back to the originating agent. " +
    "For media components (Image/Video/AudioPlayer), use workspace file paths (e.g. 'song.mp3' or './file.mp4') or HTTPS URLs. " +
    "Property name aliases: 'url', 'src', 'source', or 'imageUrl'/'videoUrl'/'audioUrl' are all accepted. " +
    "\n\nactions:\n" +
    "  createSurface — render a new surface (requires rootComponentId, components, optionally catalogId)\n" +
    "  updateComponents — patch specific components on an existing surface\n" +
    "  updateDataModel — patch the data model (re-renders bound components)\n" +
    "  deleteSurface — remove the surface from the chat",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "createSurface",
          "updateComponents",
          "updateDataModel",
          "deleteSurface",
        ],
        description: "The A2UI operation to perform",
      },
      surfaceId: {
        type: "string",
        description:
          "Unique identifier for this surface. Use a stable ID so you can update it later.",
      },
      rootComponentId: {
        type: "string",
        description:
          "ID of the root component to render (required for createSurface)",
      },
      components: {
        type: "object",
        description:
          "Flat map of componentId → component spec (required for createSurface/updateComponents). " +
          "Each value must have a 'component' field: Text | Row | Column | Button | TextField | Image | Icon | Video | AudioPlayer | " +
          "List | Card | Tabs | Modal | Divider | CheckBox | ChoicePicker | Slider | DateTimeInput. " +
          "DO NOT NEST properties under a 'properties' key; put them directly at the top-level of the spec alongside 'component'. " +
          "Children arrays contain other component IDs (strings), not nested specs.",
        additionalProperties: true,
      },
      dataModel: {
        type: "object",
        description:
          "Initial data model for the surface (used with createSurface). " +
          'Components can reference values via { "$dataModel": "/key" }.',
        additionalProperties: true,
      },
      patches: {
        type: "object",
        description:
          "JSON Pointer patches to apply to the data model (required for updateDataModel). " +
          'Keys are JSON Pointer strings like "/name" or "/count".',
        additionalProperties: true,
      },
      catalogId: {
        type: "string",
        description:
          "Optional. The A2UI catalog ID to use. Defaults to Minimal. " +
          `Available: Minimal (${A2UI_MINIMAL_CATALOG_ID}) or Basic (${A2UI_BASIC_CATALOG_ID})`,
      },
    },
    required: ["action", "surfaceId"],
  },
};
