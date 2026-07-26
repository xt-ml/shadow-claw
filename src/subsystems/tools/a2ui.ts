import type { ToolDefinition } from "./types.js";

import {
  A2UI_AVAILABLE_CATALOGS,
  A2UI_BASIC_CATALOG_ID,
} from "../../ui/a2ui/types.js";

export const availableCatalogs = {
  basic: A2UI_BASIC_CATALOG_ID,
  all: A2UI_AVAILABLE_CATALOGS,
};

export const list_components: ToolDefinition = {
  name: "list_components",
  description:
    "List all available A2UI v1.0 Basic catalog components and their schemas. " +
    "Returns a human-readable reference of component types, their required/optional properties, " +
    "data binding syntax, and examples. Call this before render_component to understand " +
    "what components are available and how to structure the input correctly.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const render_component: ToolDefinition = {
  name: "render_component",
  description:
    "Render an interactive A2UI v1.0 UI surface in the peer's chat window using the Basic catalog. " +
    "The surface appears inline in the conversation on the remote peer's side (or locally if no peer). " +
    "Components: Text, Row, Column, Button, TextField, Image, Icon, Video, AudioPlayer, " +
    "List, Card, Tabs, Modal, Divider, CheckBox, ChoicePicker, Slider, DateTimeInput. " +
    "Use list_components first to understand available components and their schemas. " +
    "All user input (button clicks, form field changes) automatically routes back to the agent. " +
    "For media components (Image/Video/AudioPlayer), use workspace file paths (e.g. 'song.mp3') or HTTPS URLs. " +
    "\n\nactions:\n" +
    "  createSurface — render a new surface (requires components array with a root component)\n" +
    "  updateComponents — add or replace components on an existing surface\n" +
    "  updateDataModel — update a single path in the data model (re-renders bound components)\n" +
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
      components: {
        type: "array",
        description:
          "Flat array of component objects (required for createSurface/updateComponents). " +
          "Each object MUST have an 'id' field and a 'component' field. " +
          "The component with id 'root' is the tree root (required for createSurface). " +
          "Component field values: Text | Row | Column | Button | TextField | Image | Icon | Video | AudioPlayer | " +
          "List | Card | Tabs | Modal | Divider | CheckBox | ChoicePicker | Slider | DateTimeInput. " +
          "Put all properties at the TOP LEVEL alongside 'component' and 'id'. " +
          "DO NOT nest properties under a 'properties' key. " +
          "Children arrays contain other component ID strings, not nested objects.",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
      dataModel: {
        type: "object",
        description:
          "Initial data model for the surface (used with createSurface). " +
          'Components can reference values via { "path": "/key" }.',
        additionalProperties: true,
      },
      path: {
        type: "string",
        description:
          "JSON Pointer path to update (required for updateDataModel). " +
          'Examples: "/result", "/user/name", "/count". ' +
          'Use "/" to replace the entire data model.',
      },
      value: {
        description:
          "New value to set at the specified path (used with updateDataModel). " +
          "Omit to delete the key at the given path.",
      },
      surfaceProperties: {
        type: "object",
        description:
          "Optional display/branding properties for this surface (e.g. agentDisplayName).",
        additionalProperties: true,
      },
    },
    required: ["action", "surfaceId"],
  },
};
