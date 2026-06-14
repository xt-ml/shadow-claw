/**
 * A2UI v1.0 — Schema-First Catalog Definitions
 *
 * This module provides:
 * - TypeScript types that mirror the A2UI Minimal and Basic catalogs.
 * - Surface envelope and action message types.
 * - Minimal helper utilities for resolving dynamic values and applying patches.
 *
 * Accuracy notes:
 * - This file is intentionally conservative. It does not assume fields or
 *   enums that are not explicitly shown in the authoritative catalog JSON.
 * - Where the catalog schema is not yet fully verified against these definitions,
 *   the code uses comments to mark those areas for final review.
 * - For the authoritative schema, consult:
 *   - Minimal: https://a2ui.org/specification/v1_0/catalogs/minimal/catalog.json
 *   - Basic:   https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json
 */

export const A2UI_MINIMAL_CATALOG_ID =
  "https://a2ui.org/specification/v1_0/catalogs/minimal/catalog.json";

export const A2UI_BASIC_CATALOG_ID =
  "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json";

/**
 * Catalog identifiers supported by this module.
 */
export const A2UI_AVAILABLE_CATALOGS = [
  A2UI_MINIMAL_CATALOG_ID,
  A2UI_BASIC_CATALOG_ID,
] as const;

export type A2UICatalogId = (typeof A2UI_AVAILABLE_CATALOGS)[number];

// ---------------------------------------------------------------------------
// Human-readable catalog references
// ---------------------------------------------------------------------------

/**
 * Human-readable reference for the Minimal catalog.
 * This text is intended for tooling and documentation only.
 */
export const MINIMAL_CATALOG_REFERENCE = `A2UI Minimal Catalog — Component Reference
==========================================

Catalog ID: ${A2UI_MINIMAL_CATALOG_ID}

CRITICAL AUTHORING RULES
-------------------------
1. Put ALL properties at the TOP LEVEL of the component spec alongside "component".
   WRONG:  {"component":"Text","properties":{"text":"Hello"}}
   RIGHT:  {"component":"Text","text":"Hello"}

2. To make a property UPDATABLE later via the "updateDataModel" action, you MUST
   bind it using {"$dataModel": "/your_key"} and initialize that key in the dataModel.
   If you use a plain string literal, the property is STATIC and cannot be updated!
   STATIC (never changes): {"component":"Text", "text":"Result will appear here"}
   DYNAMIC (updatable):    {"component":"Text", "text":{"$dataModel":"/result"}}

3. "children" and "child" contain COMPONENT ID STRINGS, not nested specs.
   WRONG:  {"component":"Column","children":[{"component":"Text","text":"Hi"}]}
   RIGHT:  {"component":"Column","children":["my_text"]}  +  "my_text":{"component":"Text","text":"Hi"}

4. Button "child" must be the ID of a Text component in the same components map.
   Button "action" must be {"id":"myActionId"} — a plain object with an id string.

Components
----------
Text        — text (string, required), variant? ("h1"-"h5"|"caption"|"body")
Row         — children (string[], required), justify?, align?
Column      — children (string[], required), justify?, align?
Button      — child (string, required — ID of a Text component for the label),
              action ({id: string, data?: string[]}, required), variant?
TextField   — label (string, required), value? (string), placeholder?,
              variant? ("shortText"|"longText"|"number"|"obscured")

Function
--------
capitalize  — {"call":"capitalize","args":{"value":"some string"}}

Example (correct)
-----------------
components: {
  "root":    {"component":"Column","children":["title","btn"]},
  "title":   {"component":"Text","text":"Hello World","variant":"h2"},
  "btn_lbl": {"component":"Text","text":"Click Me"},
  "btn":     {"component":"Button","child":"btn_lbl","action":{"id":"submit"},"variant":"primary"}
}

`;

/**
 * Human-readable reference for the Basic catalog.
 */
export const BASIC_CATALOG_REFERENCE = `A2UI Basic Catalog — Component & Function Reference
==========================================

Catalog ID: ${A2UI_BASIC_CATALOG_ID}

Notes
-----
The Basic catalog includes ALL Minimal components (Text, Row, Column, Button,
TextField) PLUS the following. To use any of these, set catalogId to
"${A2UI_BASIC_CATALOG_ID}" (or the shorthand "Basic") in render_component.

Additional Components
---------------------
Image         — url (required), description?, fit?, variant?
Icon          — name (required; string or {path})
Video         — url (required), posterUrl?
AudioPlayer   — url (required), description?
List          — children[] (required), direction?, align?
Card          — child (required; component ID string)
Tabs          — tabs[] (each: {title, child})
Modal         — trigger (component ID), content (component ID)
Divider       — axis? ("horizontal"|"vertical")
CheckBox      — label (required), value (DynamicBoolean)
ChoicePicker  — label?, variant? ("mutuallyExclusive"|"multipleSelection"),
                options[] (each: {label, value}), value (DynamicStringList),
                displayStyle? ("checkbox"|"chips"), filterable?
Slider        — max (required), value (DynamicNumber), label?, min?, steps?
DateTimeInput — value (required; DynamicString), enableDate?, enableTime?,
                min?, max?, label?

Example — ChoicePicker (correct)
----------------------------------
"cmd_picker": {
  "component": "ChoicePicker",
  "label": "Select Command",
  "variant": "mutuallyExclusive",
  "options": [
    {"label": "List files", "value": "ls -la"},
    {"label": "Date",       "value": "date"},
    {"label": "Who am I",   "value": "whoami"}
  ],
  "value": "ls -la"
}

Remember: set catalogId to "${A2UI_BASIC_CATALOG_ID}" (or "Basic") when using any
Basic component. All other authoring rules from the Minimal catalog apply here too.
`;

// ---------------------------------------------------------------------------
// Dynamic values (schema-agnostic helpers)
// ---------------------------------------------------------------------------

/** Literal string value. */
export type StaticString = string;

/**
 * Data model reference as defined by the catalog:
 * { "$dataModel": "/path" }
 */
export interface DataModelRef {
  $dataModel: string;
}

/**
 * Alternate path reference form supported by helpers.
 * The catalog primarily defines `$dataModel`; this form is a convenience
 * for local tooling.
 */
export interface PathRef {
  path: string;
}

/**
 * Function call expression supported by the runtime helper.
 * The Minimal catalog defines `capitalize`; more functions may be
 * available in the Basic catalog.
 */
export interface CapitalizeCall {
  call: "capitalize";
  args: { value: DynamicString };
}

/**
 * A value that may be resolved dynamically at render time.
 *
 * The catalog primarily defines:
 * - literal string
 * - { "$dataModel": "/path" }
 *
 * This type also includes `PathRef` and `CapitalizeCall` as practical
 * extensions for runtime helpers.
 */
export type DynamicString =
  | StaticString
  | DataModelRef
  | PathRef
  | CapitalizeCall;

/**
 * A boolean that may be resolved dynamically at render time.
 */
export type DynamicBoolean = boolean | DataModelRef | PathRef;

/**
 * A number that may be resolved dynamically at render time.
 */
export type DynamicNumber = number | DataModelRef | PathRef;

/**
 * A string list that may be resolved dynamically at render time.
 */
export type DynamicStringList = string[] | DataModelRef | PathRef;

// ---------------------------------------------------------------------------
// Shared component fields
// ---------------------------------------------------------------------------

/**
 * Fields shared by all component specifications.
 * This mirrors the common base defined in the catalog schema.
 */
export interface ComponentCommon {
  id: string;
  weight?: number;
}

/**
 * Fields shared by checkable components.
 */
export interface CheckableComponent {
  checked?: DynamicBoolean;
}

// ---------------------------------------------------------------------------
// Minimal catalog components (schema-first)
// ---------------------------------------------------------------------------

/**
 * Text variant identifiers.
 * Final enum values should be verified against the Minimal catalog JSON.
 */
export type TextVariant = "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body";

/**
 * Text component.
 */
export interface TextSpec extends ComponentCommon {
  component: "Text";
  text: DynamicString;
  variant?: TextVariant;
}

/**
 * Justify values for flex layout.
 * Final enum values should be verified against the catalog JSON.
 */
export type JustifyValue =
  | "start"
  | "center"
  | "end"
  | "spaceBetween"
  | "spaceAround"
  | "spaceEvenly"
  | "stretch";

/**
 * Align values for flex layout.
 * Final enum values should be verified against the catalog JSON.
 */
export type AlignValue = "start" | "center" | "end" | "stretch";

/**
 * Row (horizontal flex layout).
 */
export interface RowSpec extends ComponentCommon {
  component: "Row";
  children: string[];
  justify?: JustifyValue;
  align?: AlignValue;
}

/**
 * Column (vertical flex layout).
 */
export interface ColumnSpec extends ComponentCommon {
  component: "Column";
  children: string[];
  justify?: JustifyValue;
  align?: AlignValue;
}

/**
 * Button variant identifiers.
 * Final enum values verified against the catalog JSON.
 */
export type ButtonVariant = "default" | "primary" | "borderless";

/**
 * Action descriptor attached to interactive components.
 */
export interface A2UIActionDescriptor {
  id: string;
  data?: string[];
}

/**
 * Button component.
 */
export interface ButtonSpec extends ComponentCommon, CheckableComponent {
  component: "Button";
  child: string;
  action: A2UIActionDescriptor;
  variant?: ButtonVariant;
}

/**
 * TextField variant identifiers.
 * Final enum values should be verified against the catalog JSON.
 */
export type TextFieldVariant = "shortText" | "longText" | "number" | "obscured";

/**
 * TextField component.
 */
export interface TextFieldSpec extends ComponentCommon, CheckableComponent {
  component: "TextField";
  label: DynamicString;
  value?: DynamicString;
  placeholder?: DynamicString;
  variant?: TextFieldVariant;
  validationRegexp?: string;
}

// Minimal catalog union
export type MinimalCatalogComponentSpec =
  | TextSpec
  | RowSpec
  | ColumnSpec
  | ButtonSpec
  | TextFieldSpec;

// ---------------------------------------------------------------------------
// Basic catalog subset (schema-first, conservative)
// ---------------------------------------------------------------------------

/**
 * Image component.
 */
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

/**
 * Icon component.
 */
export interface IconSpec extends ComponentCommon {
  component: "Icon";
  name: string | { path: string };
}

/**
 * Video component.
 */
export interface VideoSpec extends ComponentCommon {
  component: "Video";
  url: DynamicString;
  posterUrl?: DynamicString;
}

/**
 * AudioPlayer component.
 */
export interface AudioPlayerSpec extends ComponentCommon {
  component: "AudioPlayer";
  url: DynamicString;
  description?: DynamicString;
}

/**
 * List component.
 */
export interface ListSpec extends ComponentCommon {
  component: "List";
  children: string[];
  direction?: "vertical" | "horizontal";
  align?: AlignValue;
}

/**
 * Card component.
 */
export interface CardSpec extends ComponentCommon {
  component: "Card";
  child: string;
}

/**
 * Tabs component.
 */
export interface TabsSpec extends ComponentCommon {
  component: "Tabs";
  tabs: { title: DynamicString; child: string }[];
}

/**
 * Modal component.
 */
export interface ModalSpec extends ComponentCommon {
  component: "Modal";
  trigger: string;
  content: string;
}

/**
 * Divider component.
 */
export interface DividerSpec extends ComponentCommon {
  component: "Divider";
  axis?: "horizontal" | "vertical";
}

/**
 * CheckBox component.
 */
export interface CheckBoxSpec extends ComponentCommon, CheckableComponent {
  component: "CheckBox";
  label: DynamicString;
  value: DynamicBoolean;
}

/**
 * ChoicePicker option.
 */
export interface ChoicePickerOption {
  label: DynamicString;
  value: string;
}

/**
 * ChoicePicker component.
 */
export interface ChoicePickerSpec extends ComponentCommon, CheckableComponent {
  component: "ChoicePicker";
  label?: DynamicString;
  variant?: "multipleSelection" | "mutuallyExclusive";
  options: ChoicePickerOption[];
  value: DynamicStringList;
  displayStyle?: "checkbox" | "chips";
  filterable?: boolean;
}

/**
 * Slider component.
 */
export interface SliderSpec extends ComponentCommon, CheckableComponent {
  component: "Slider";
  label?: DynamicString;
  min?: number;
  max: number;
  value: DynamicNumber;
  steps?: number;
}

/**
 * DateTimeInput component.
 */
export interface DateTimeInputSpec extends ComponentCommon, CheckableComponent {
  component: "DateTimeInput";
  value: DynamicString;
  enableDate?: boolean;
  enableTime?: boolean;
  min?: DynamicString;
  max?: DynamicString;
  label?: DynamicString;
}

// Basic catalog union (includes Minimal)
export type BasicCatalogComponentSpec =
  | MinimalCatalogComponentSpec
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

/** Combined union for both catalogs. */
export type A2UIComponentSpecExtended = BasicCatalogComponentSpec;

/** Backward-compatible union name. */
export type A2UIComponentSpec = A2UIComponentSpecExtended;

// ---------------------------------------------------------------------------
// Surface envelopes
// ---------------------------------------------------------------------------

export interface A2UICreateSurface {
  type: "createSurface";
  surfaceId: string;
  catalogId: A2UICatalogId;
  components: Record<string, A2UIComponentSpec>;
  dataModel?: Record<string, unknown>;
  rootComponentId: string;
}

export interface A2UIUpdateComponents {
  type: "updateComponents";
  surfaceId: string;
  components: Record<string, A2UIComponentSpec>;
}

export interface A2UIUpdateDataModel {
  type: "updateDataModel";
  surfaceId: string;
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
// Client actions
// ---------------------------------------------------------------------------

export interface A2UIAction {
  type: "a2ui-action";
  surfaceId: string;
  actionId: string;
  dataModel: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Transport wrappers (transport-agnostic)
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
// Runtime helpers (best-effort, explicitly minimal)
// ---------------------------------------------------------------------------

/**
 * Resolve a dynamic string against a data model.
 *
 * Supported values:
 * - literal string
 * - { "$dataModel": "/path" }
 * - { "path": "/path" }
 * - { "call": "capitalize", "args": { "value": ... } }
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
 * Apply JSON Pointer patches to a data model.
 *
 * This implementation supports top-level paths only.
 */
export function applyDataModelPatches(
  dataModel: Record<string, unknown>,
  patches: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...dataModel };

  for (const [pointer, value] of Object.entries(patches)) {
    const key = pointer.replace(/^\//, "");
    next[key] = value;
  }

  return next;
}
