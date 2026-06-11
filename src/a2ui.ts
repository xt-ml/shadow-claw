/**
 * A2UI v1.0 Minimal Catalog — TypeScript types
 *
 * Based on: https://github.com/a2ui-project/a2ui/tree/main/specification/v1_0/catalogs/minimal
 *
 * Five components: Text, Row, Column, Button, TextField
 * One function:    capitalize
 *
 * Transport binding: each A2UI envelope maps to a `kind: "a2ui"` part in an
 * A2A `message/send` JSON-RPC envelope over PeerJS WebRTC.
 */

export const A2UI_MINIMAL_CATALOG_ID =
  "https://a2ui.org/specification/v1_0/catalogs/minimal/catalog.json";

export const A2UI_BASIC_CATALOG_ID =
  "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json";

/**
 * Registry of all supported A2UI catalog IDs.
 * Use this to discover available catalogs programmatically.
 */
export const A2UI_AVAILABLE_CATALOGS = [
  A2UI_MINIMAL_CATALOG_ID,
  A2UI_BASIC_CATALOG_ID,
];

// ---------------------------------------------------------------------------
// Human-readable catalog reference (used by list_components tool)
// ---------------------------------------------------------------------------
export const MINIMAL_CATALOG_REFERENCE = `A2UI Minimal Catalog — Component Reference
==========================================

Catalog ID: ${A2UI_MINIMAL_CATALOG_ID}

IMPORTANT: When calling render_component you must pass the action "createSurface"
with a flat "components" map (id → spec) and a "rootComponentId". Component IDs
are strings you choose freely. Children arrays contain component IDs, not specs.

Components
----------

Text
  Required: text (string | { "$dataModel": "/key" } | { "call": "capitalize", "args": { "value": ... } })
  Optional: variant ("h1"|"h2"|"h3"|"h4"|"h5"|"caption"|"body"), weight (number)

Row  — horizontal flex layout
  Required: children (string[] — list of component IDs)
  Optional: justify ("start"|"center"|"end"|"spaceBetween"|"spaceAround"|"spaceEvenly"|"stretch")
            align ("start"|"center"|"end"|"stretch"), weight (number)

Column  — vertical flex layout
  Required: children (string[] — list of component IDs)
  Optional: justify, align, weight (same enums as Row)

Button
  Required: child (string — ID of a Text component for the label)
            action: { id: "actionId", data?: ["/dataModel/path"] }
  Optional: variant ("primary"|"borderless"), weight (number)

TextField
  Required: label (DynamicString)
  Optional: value (DynamicString — two-way bound), variant ("shortText"|"longText"|"number"|"obscured")
            validationRegexp (string), weight (number)

Functions (usable as DynamicString)
-------------------------------------
capitalize: { "call": "capitalize", "args": { "value": "<DynamicString>" } }

DataModel references
---------------------
Use { "$dataModel": "/key" } anywhere a DynamicString is accepted to bind to the surface data model.

Example — simple form
----------------------
{
  "action": "createSurface",
  "surfaceId": "contact-form",
  "rootComponentId": "root",
  "dataModel": { "name": "" },
  "components": {
    "root": { "id": "root", "component": "Column", "children": ["nameField", "submitBtn"] },
    "nameField": { "id": "nameField", "component": "TextField", "label": "Your name", "value": { "$dataModel": "/name" } },
    "label": { "id": "label", "component": "Text", "text": "Submit" },
    "submitBtn": { "id": "submitBtn", "component": "Button", "child": "label", "action": { "id": "submit" } }
  }
}

`;

export const BASIC_CATALOG_REFERENCE = `A2UI Basic Catalog — Component & Function Reference
==========================================

Catalog ID: ${A2UI_BASIC_CATALOG_ID}

The Basic catalog expands the Minimal catalog with additional components and
client-side functions. Notable components include: Image, Icon, Video,
AudioPlayer, List, Card, Tabs, Modal, Divider, CheckBox, ChoicePicker,
Slider, DateTimeInput, and the layout primitives (Row, Column, etc.).

The Basic catalog also supplies a richer set of functions for validation and
formatting (for example: 'required', 'regex', 'length', 'numeric', 'email',
'formatString', 'formatNumber', 'formatCurrency', 'formatDate', 'pluralize',
'openUrl', and logical helpers like 'and'/'or'/'not').

For the authoritative schema and full component/function list, see:
https://raw.githubusercontent.com/a2ui-project/a2ui/main/specification/v1_0/catalogs/basic/catalog.json
`;

// ---------------------------------------------------------------------------
// DynamicString — literal string OR a JSON Pointer reference into the data model
// ---------------------------------------------------------------------------

/** A plain string value */
export type StaticString = string;

/** A JSON Pointer reference into the surface data model: { "$dataModel": "/path" } */
export interface DataModelRef {
  $dataModel: string;
}

/** A JSON Pointer reference into the surface data model using `path`: { "path": "/path" } */
export interface PathRef {
  path: string;
}

/** A function call expression: { "call": "capitalize", "args": { "value": ... } } */
export interface CapitalizeCall {
  call: "capitalize";
  args: { value: DynamicString };
}

export type DynamicString =
  | StaticString
  | DataModelRef
  | PathRef
  | CapitalizeCall;

// ---------------------------------------------------------------------------
// Component specs
// ---------------------------------------------------------------------------

/** Common fields shared by every component */
export interface ComponentCommon {
  /** Unique ID within this surface's component map */
  id: string;
  /** Flex weight (similar to CSS flex-grow) */
  weight?: number;
}

export type TextVariant = "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body";

export interface TextSpec extends ComponentCommon {
  component: "Text";
  text: DynamicString;
  variant?: TextVariant;
}

export type JustifyValue =
  | "center"
  | "end"
  | "spaceAround"
  | "spaceBetween"
  | "spaceEvenly"
  | "start"
  | "stretch";

export type AlignValue = "start" | "center" | "end" | "stretch";

export interface RowSpec extends ComponentCommon {
  component: "Row";
  children: string[]; // list of child component IDs
  justify?: JustifyValue;
  align?: AlignValue;
}

export interface ColumnSpec extends ComponentCommon {
  component: "Column";
  children: string[]; // list of child component IDs
  justify?: JustifyValue;
  align?: AlignValue;
}

export type ButtonVariant = "primary" | "borderless";

export interface ButtonSpec extends ComponentCommon {
  component: "Button";
  child: string; // component ID of the button label
  variant?: ButtonVariant;
  action: A2UIActionDescriptor;
  checked?: boolean;
}

export type TextFieldVariant = "longText" | "number" | "shortText" | "obscured";

export interface TextFieldSpec extends ComponentCommon {
  component: "TextField";
  label: DynamicString;
  value?: DynamicString;
  variant?: TextFieldVariant;
  validationRegexp?: string;
  checked?: boolean;
}

// Note: full A2UIComponentSpec union (including Basic catalog types)
// is defined below as `A2UIComponentSpecExtended` and re-exported.

// ---------------------------------------------------------------------------
// Basic catalog component specs (subset)
// ---------------------------------------------------------------------------

export interface ImageSpec extends ComponentCommon {
  component: "Image";
  url: DynamicString;
  description?: DynamicString;
  fit?: "contain" | "cover" | "fill" | "none" | "scaleDown";
  variant?:
    | "icon"
    | "avatar"
    | "smallFeature"
    | "mediumFeature"
    | "largeFeature"
    | "header";
}

export interface IconSpec extends ComponentCommon {
  component: "Icon";
  // either a named icon key or an object with a path to a custom icon
  name: string | { path: string };
}

export interface VideoSpec extends ComponentCommon {
  component: "Video";
  url: DynamicString;
  posterUrl?: DynamicString;
}

export interface AudioPlayerSpec extends ComponentCommon {
  component: "AudioPlayer";
  url: DynamicString;
  description?: DynamicString;
}

export interface ListSpec extends ComponentCommon {
  component: "List";
  children: string[]; // simple child list (templates not supported here)
  direction?: "vertical" | "horizontal";
  align?: AlignValue;
}

export interface CardSpec extends ComponentCommon {
  component: "Card";
  child: string; // single child component id
}

export interface TabsSpec extends ComponentCommon {
  component: "Tabs";
  tabs: { title: DynamicString; child: string }[];
}

export interface ModalSpec extends ComponentCommon {
  component: "Modal";
  trigger: string; // component id of trigger
  content: string; // component id of content
}

export interface DividerSpec extends ComponentCommon {
  component: "Divider";
  axis?: "horizontal" | "vertical";
}

export interface CheckBoxSpec extends ComponentCommon {
  component: "CheckBox";
  label: DynamicString;
  // value may be a boolean or a $dataModel reference; keep it flexible here
  value: boolean | DataModelRef | DynamicString;
}

export interface ChoicePickerOption {
  label: DynamicString;
  value: string;
}

export interface ChoicePickerSpec extends ComponentCommon {
  component: "ChoicePicker";
  label?: DynamicString;
  variant?: "multipleSelection" | "mutuallyExclusive";
  options: ChoicePickerOption[];
  // bound value: single string or array encoded as JSON in dataModel
  value: DynamicString | string[];
  displayStyle?: "checkbox" | "chips";
  filterable?: boolean;
}

export interface SliderSpec extends ComponentCommon {
  component: "Slider";
  label?: DynamicString;
  min?: number;
  max: number;
  value: number | DynamicString;
  steps?: number;
}

export interface DateTimeInputSpec extends ComponentCommon {
  component: "DateTimeInput";
  value: DynamicString;
  enableDate?: boolean;
  enableTime?: boolean;
  min?: DynamicString;
  max?: DynamicString;
  label?: DynamicString;
}

export type A2UIComponentSpecExtended =
  | TextSpec
  | RowSpec
  | ColumnSpec
  | ButtonSpec
  | TextFieldSpec
  | ImageSpec
  | IconSpec
  | VideoSpec
  | AudioPlayerSpec
  | ListSpec
  | CardSpec
  | TabsSpec
  | ModalSpec
  | DividerSpec
  | CheckBoxSpec
  | ChoicePickerSpec
  | SliderSpec
  | DateTimeInputSpec;

// Backwards-compatible export name
export type A2UIComponentSpec = A2UIComponentSpecExtended;

// ---------------------------------------------------------------------------
// Action descriptor (embedded in Button, TextField)
// ---------------------------------------------------------------------------

/** Describes the action to dispatch when a component is activated */
export interface A2UIActionDescriptor {
  /** Unique action identifier sent back to the server/agent */
  id: string;
  /** Optional data model paths to include in the action payload */
  data?: string[];
}

// ---------------------------------------------------------------------------
// Surface messages (server → client)
// ---------------------------------------------------------------------------

export interface A2UICreateSurface {
  type: "createSurface";
  surfaceId: string;
  catalogId: typeof A2UI_MINIMAL_CATALOG_ID;
  /** Flat map of componentId → component spec (adjacency list) */
  components: Record<string, A2UIComponentSpec>;
  /** Initial data model */
  dataModel?: Record<string, unknown>;
  /** ID of the root component to render */
  rootComponentId: string;
}

export interface A2UIUpdateComponents {
  type: "updateComponents";
  surfaceId: string;
  /** Partial component specs to merge into the existing map */
  components: Record<string, A2UIComponentSpec>;
}

export interface A2UIUpdateDataModel {
  type: "updateDataModel";
  surfaceId: string;
  /** JSON Pointer patches: { "/path": value } */
  patches: Record<string, unknown>;
}

export interface A2UIDeleteSurface {
  type: "deleteSurface";
  surfaceId: string;
}

export type A2UIEnvelope =
  | A2UICreateSurface
  | A2UIUpdateComponents
  | A2UIUpdateDataModel
  | A2UIDeleteSurface;

// ---------------------------------------------------------------------------
// Action message (client → server)
// ---------------------------------------------------------------------------

/** Sent back to the originating peer when the user interacts with a surface */
export interface A2UIAction {
  type: "a2ui-action";
  surfaceId: string;
  actionId: string;
  /** Current data model values (full snapshot) */
  dataModel: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Wire parts for PeerJS A2A envelope
// ---------------------------------------------------------------------------

export interface A2UIWirePart {
  kind: "a2ui";
  envelope: A2UIEnvelope;
}

export interface A2UIActionWirePart {
  kind: "a2ui-action";
  action: A2UIAction;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a DynamicString against a data model using a minimal JSON Pointer
 * resolver (RFC 6901). Returns the resolved string value.
 * Safely handles undefined/null input.
 */
export function resolveDynamicString(
  value: DynamicString | undefined | null,
  dataModel: Record<string, unknown>,
): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "$dataModel" in value) {
    return String(resolveJsonPointer(dataModel, value.$dataModel) ?? "");
  }

  if (typeof value === "object" && "path" in value) {
    return String(resolveJsonPointer(dataModel, value.path) ?? "");
  }

  if (
    typeof value === "object" &&
    "call" in value &&
    value.call === "capitalize"
  ) {
    const inner = resolveDynamicString(value.args.value, dataModel);

    return inner.charAt(0).toUpperCase() + inner.slice(1);
  }

  return "";
}

/**
 * Minimal RFC 6901 JSON Pointer resolver.
 * e.g. "/foo/0/bar" → obj.foo[0].bar
 */
export function resolveJsonPointer(obj: unknown, pointer: string): unknown {
  if (!pointer || pointer === "/") {
    return obj;
  }

  const tokens = pointer
    .replace(/^\//, "")
    .split("/")
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = obj;
  for (const token of tokens) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

/**
 * Apply JSON Pointer patches to a data model (immutable, returns new object).
 */
export function applyDataModelPatches(
  dataModel: Record<string, unknown>,
  patches: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...dataModel };

  for (const [pointer, value] of Object.entries(patches)) {
    const key = pointer.replace(/^\//, "");
    // For now only support top-level patches (/key)
    next[key] = value;
  }

  return next;
}
