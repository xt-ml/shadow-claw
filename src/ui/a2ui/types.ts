/**
 * A2UI v1.0 — Spec-Compliant Type Definitions
 *
 * This module provides:
 * - TypeScript types that mirror the A2UI v1.0 Basic catalog.
 * - Surface envelope and action message types (spec wire format).
 * - Runtime helpers for resolving dynamic values and updating data models.
 *
 * Spec reference: https://a2ui.org/specification/v1_0/docs/a2ui_protocol.md
 *
 * Design notes:
 * - Only the official Basic catalog exists in the v1.0 spec.
 *   The "Minimal" catalog URL was a proprietary construct and has been removed.
 * - `components` in envelopes is a flat array (spec §updateComponents), each
 *   with an embedded `id`. Internally, SurfaceState normalises to a map.
 * - Data binding uses `{ "path": "/key" }` (spec §DynamicString). The legacy
 *   `{ "$dataModel": "/key" }` form is still resolved for backward compatibility
 *   but is deprecated and should not be used in new code.
 * - `updateDataModel` uses a single `path` + `value` pair (spec §updateDataModel).
 *   The former `patches` map was a non-standard extension and has been removed.
 * - The root component must have `id: "root"` (spec §ComponentsList).
 *   The `rootComponentId` wire field has been removed.
 */

// ---------------------------------------------------------------------------
// Catalog identifiers
// ---------------------------------------------------------------------------

/**
 * The official A2UI v1.0 Basic catalog.
 * @see https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json
 */
export const A2UI_BASIC_CATALOG_ID =
  "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json";

/**
 * Catalog identifiers shipped with ShadowClaw.
 * Currently only the official Basic catalog is available.
 *
 * Future ShadowClaw-specific catalogs should be added here alongside their
 * dedicated `A2UI_SHADOWCLAW_*_CATALOG_ID` constants so the renderer and
 * tooling can enumerate them automatically.
 */
export const A2UI_AVAILABLE_CATALOGS = [A2UI_BASIC_CATALOG_ID] as const;

/**
 * A valid catalog identifier accepted by this renderer.
 *
 * The type is intentionally `string` (not a strict union of `A2UI_AVAILABLE_CATALOGS`)
 * to allow third-party and future ShadowClaw-specific catalog URLs to be used
 * without requiring a TypeScript change. Use the named constants (e.g.
 * `A2UI_BASIC_CATALOG_ID`) for known catalogs.
 */
export type A2UICatalogId = string;

// ---------------------------------------------------------------------------
// Human-readable catalog reference (returned by the list_components tool)
// ---------------------------------------------------------------------------

/**
 * Human-readable reference for the A2UI Basic catalog.
 * This text is shown to the agent when it calls list_components.
 */
export const BASIC_CATALOG_REFERENCE = `A2UI Basic Catalog — Component & Function Reference
=====================================================

Catalog ID: ${A2UI_BASIC_CATALOG_ID}

CRITICAL AUTHORING RULES
-------------------------
1. Put ALL properties at the TOP LEVEL of each component object alongside "component" and "id".
   WRONG:  {"id":"t","component":"Text","properties":{"text":"Hello"}}
   RIGHT:  {"id":"t","component":"Text","text":"Hello"}

2. "components" is a FLAT ARRAY of objects, each with a required "id" field.
   The root of the component tree MUST have id "root".
   WRONG:  {"root": {"component":"Column","children":["title"]}}
   RIGHT:  [{"id":"root","component":"Column","children":["title"]},{"id":"title","component":"Text","text":"Hello"}]

3. To make a property UPDATABLE later via the "updateDataModel" action, bind it
   using {"path": "/your_key"} and initialise that key in the dataModel.
   STATIC (never changes): {"id":"t","component":"Text","text":"Result will appear here"}
   DYNAMIC (updatable):    {"id":"t","component":"Text","text":{"path":"/result"}}

4. "children" and "child" contain COMPONENT ID STRINGS, not nested objects.
   WRONG:  {"id":"col","component":"Column","children":[{"component":"Text","text":"Hi"}]}
   RIGHT:  [{"id":"col","component":"Column","children":["hi"]},{"id":"hi","component":"Text","text":"Hi"}]

5. Button "child" must be the id of a Text component in the same components array.
   Button "action" must be {"event":{"name":"myActionId"}}.

6. Use updateDataModel with a single path and value per call:
   action: "updateDataModel", surfaceId: "s", path: "/result", value: "done!"
   To update multiple fields, call render_component once per field.

7. To concatenate or inject data bindings into strings, use formatString:
   {"call":"formatString","args":{"value":"Hello \${/user/name}"}}

Components
----------
Text         — text (string or {"path":"/key"}, required), variant? ("caption"|"body")
Row          — children (string[] or template {"path":"/list","componentId":"tmpl"}, required), justify?, align?
Column       — children (string[] or template, required), justify?, align?
Button       — child (string, required — id of a Text or Icon component),
               action ({"event":{"name":"myActionId"}}, required), variant? ("default"|"primary"|"borderless")
TextField    — label (required), value? ({"path":"/key"}), placeholder?,
               variant? ("shortText"|"longText"|"number"|"obscured")
Image        — url (required), description?, fit?, variant?
Icon         — name (required; enum string, {"svgPath":"..."}, or {"path":"/key"})
Video        — url (required), posterUrl?
AudioPlayer  — url (required), description?
List         — children (string[] or template, required), direction?, align?
Card         — child (required; component id string)
Tabs         — tabs[] (each: {title, child}, required)
Modal        — trigger (component id, required), content (component id, required)
Divider      — axis? ("horizontal"|"vertical")
CheckBox     — label (required), value ({"path":"/key"} or boolean, required)
ChoicePicker — label?, variant? ("mutuallyExclusive"|"multipleSelection"),
               options[] (each: {label, value}, required), value ({"path":"/key"}, required),
               displayStyle? ("checkbox"|"chips"), filterable?
Slider       — max (required), value ({"path":"/key"} or number, required), label?, min?, steps?
DateTimeInput — value (required; {"path":"/key"} or ISO 8601 string), enableDate?, enableTime?,
                min?, max?, label?

Functions (data binding & validation)
---------------------------------------
formatString(value)          — string interpolation: {"call":"formatString","args":{"value":"Hi \${/name}"}}
formatNumber(value,decimals?,grouping?)  — number formatting
formatCurrency(value,currency,decimals?,grouping?) — currency formatting
formatDate(value,format)     — date formatting using Unicode TR35 patterns
pluralize(value,one,other,...) — CLDR plural-aware string selection
openUrl(url)                 — open a URL (action function, no return value)
required(value)              — validation: checks value is not empty
regex(value,pattern)         — validation: checks value matches regex
length(value,min?,max?)      — validation: checks string length
numeric(value,min?,max?)     — validation: checks number range
email(value)                 — validation: checks value is a valid email
and(values[])                — logical AND of boolean values
or(values[])                 — logical OR of boolean values
not(value)                   — logical NOT of a boolean value

NOTE: ShadowClaw additionally supports "capitalize" as an extension function
(not in the official spec): {"call":"capitalize","args":{"value":{"path":"/name"}}}

Validator / boolean functions evaluate to boolean and are used in "checks" rules;
they do not produce a displayable string.

Example (correct — createSurface)
----------------------------------
action: "createSurface"
surfaceId: "my-surface"
components: [
  {"id":"root",    "component":"Column","children":["title","btn"]},
  {"id":"title",   "component":"Text","text":"Hello World","variant":"body"},
  {"id":"btn_lbl", "component":"Text","text":"Click Me"},
  {"id":"btn",     "component":"Button","child":"btn_lbl","action":{"event":{"name":"submit"}},"variant":"primary"}
]

Example (updateDataModel)
--------------------------
action: "updateDataModel"
surfaceId: "my-surface"
path: "/result"
value: "done!"
`;

// ---------------------------------------------------------------------------
// Dynamic values (data binding)
// ---------------------------------------------------------------------------

/** Literal string value. */
export type StaticString = string;

/**
 * Spec-canonical data binding reference: { "path": "/json/pointer" }
 *
 * This is the form defined in the A2UI v1.0 spec §DynamicString.
 * Use this in all new code.
 */
export interface PathRef {
  path: string;
}

/**
 * Legacy data binding reference: { "$dataModel": "/json/pointer" }
 *
 * @deprecated Use {@link PathRef} (`{ "path": "/key" }`) instead.
 * This form is not in the A2UI v1.0 spec and is kept only for backward
 * compatibility with existing surfaces. The runtime resolver handles both.
 */
export interface DataModelRef {
  $dataModel: string;
}

// ---------------------------------------------------------------------------
// Function call types (A2UI v1.0 Basic catalog §functions)
// ---------------------------------------------------------------------------

export interface CapitalizeCall {
  call: "capitalize";
  args: { value: DynamicString };
}

/** Interpolates ${/pointer} placeholders in a template string. */
export interface FormatStringCall {
  call: "formatString";
  args: { value: DynamicString };
}

export interface FormatNumberCall {
  call: "formatNumber";
  args: {
    value: DynamicNumber;
    decimals?: DynamicNumber;
    grouping?: DynamicBoolean;
  };
}

export interface FormatCurrencyCall {
  call: "formatCurrency";
  args: {
    value: DynamicNumber;
    currency: DynamicString;
    decimals?: DynamicNumber;
    grouping?: DynamicBoolean;
  };
}

/** format: Unicode TR35 date/time pattern string */
export interface FormatDateCall {
  call: "formatDate";
  args: { value: DynamicString; format: DynamicString };
}

/** CLDR plural-aware string selection. */
export interface PluralizeCall {
  call: "pluralize";
  args: {
    value: DynamicNumber;
    one: DynamicString;
    other: DynamicString;
    [cldrKey: string]: unknown;
  };
}

/** Opens a URL in the browser. Action-only; no return value. */
export interface OpenUrlCall {
  call: "openUrl";
  args: { url: DynamicString };
}

// --- Boolean combinators ---
export interface AndCall {
  call: "and";
  args: { values: DynamicBoolean[] };
}
export interface OrCall {
  call: "or";
  args: { values: DynamicBoolean[] };
}
export interface NotCall {
  call: "not";
  args: { value: DynamicBoolean };
}

// --- Validation / check functions ---
export interface RequiredCall {
  call: "required";
  args: { value: DynamicString };
}
export interface RegexCall {
  call: "regex";
  args: { value: DynamicString; pattern: DynamicString };
}
export interface LengthCall {
  call: "length";
  args: { value: DynamicString; min?: DynamicNumber; max?: DynamicNumber };
}
export interface NumericCall {
  call: "numeric";
  args: { value: DynamicNumber; min?: DynamicNumber; max?: DynamicNumber };
}
export interface EmailCall {
  call: "email";
  args: { value: DynamicString };
}

/** Union of all supported function call expressions. */
export type FunctionCall =
  | CapitalizeCall
  | FormatStringCall
  | FormatNumberCall
  | FormatCurrencyCall
  | FormatDateCall
  | PluralizeCall
  | OpenUrlCall
  | AndCall
  | OrCall
  | NotCall
  | RequiredCall
  | RegexCall
  | LengthCall
  | NumericCall
  | EmailCall;

/**
 * A value that may be resolved dynamically at render time.
 *
 * Canonical forms (A2UI v1.0 spec):
 * - Literal string: `"Hello"`
 * - Path reference: `{ "path": "/user/name" }`
 * - Function call:  `{ "call": "formatString", "args": { "value": "Hi ${/name}" } }`
 *
 * Deprecated form (kept for backward compatibility):
 * - `{ "$dataModel": "/key" }` — resolved by the runtime but not spec-compliant.
 */
export type DynamicString =
  | StaticString
  | PathRef
  | DataModelRef
  | FunctionCall;

/**
 * A boolean that may be resolved dynamically at render time.
 */
export type DynamicBoolean = boolean | PathRef | DataModelRef | FunctionCall;

/**
 * A number that may be resolved dynamically at render time.
 */
export type DynamicNumber = number | PathRef | DataModelRef;

/**
 * A string list that may be resolved dynamically at render time.
 */
export type DynamicStringList = string[] | PathRef | DataModelRef;

// ---------------------------------------------------------------------------
// Shared component fields
// ---------------------------------------------------------------------------

/**
 * Fields shared by all component specifications.
 * Every component in the `components` array MUST have an `id`.
 * One component MUST have `id: "root"` to serve as the tree root (spec §179).
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
// Component specifications (Basic catalog — the only official v1.0 catalog)
// ---------------------------------------------------------------------------

/**
 * Children of a layout component.
 *
 * Can be:
 * - A fixed array of component IDs: `["header", "body", "footer"]`
 * - A template that generates children from a data model list:
 *   `{ "path": "/items", "componentId": "item_template" }`
 *   (spec §ChildList / §DataDrivenChildren)
 */
export type ChildList = string[] | { path: string; componentId: string };

/**
 * Text display variants.
 *
 * Spec-official values: `"caption"` | `"body"`
 *
 * ShadowClaw extension values (not in spec, but rendered by the client):
 * `"h1"` | `"h2"` | `"h3"` | `"h4"` | `"h5"`
 *
 * LLMs have been trained on the extension values and they render correctly.
 * When targeting maximum spec compliance, prefer `"body"` or `"caption"`.
 */
export type TextVariant =
  | "caption"
  | "body"
  // ShadowClaw extensions (not in official spec)
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5";

export interface TextSpec extends ComponentCommon {
  component: "Text";
  text: DynamicString;
  variant?: TextVariant;
}

export type JustifyValue =
  | "start"
  | "center"
  | "end"
  | "spaceBetween"
  | "spaceAround"
  | "spaceEvenly"
  | "stretch";

export type AlignValue = "start" | "center" | "end" | "stretch";

export interface RowSpec extends ComponentCommon {
  component: "Row";
  children: ChildList;
  justify?: JustifyValue;
  align?: AlignValue;
}

export interface ColumnSpec extends ComponentCommon {
  component: "Column";
  children: ChildList;
  justify?: JustifyValue;
  align?: AlignValue;
}

export type ButtonVariant = "default" | "primary" | "secondary" | "borderless";

/**
 * A2UI v1.0 spec §actions: server action event sent when a button is clicked.
 */
export interface A2UIActionEvent {
  /** The event name routed back to the agent. */
  name: string;
  /**
   * Optional static context attached to the action.
   * Use this to pass per-button metadata without polluting the data model.
   */
  context?: Record<string, unknown>;
  /**
   * If true the agent is expected to respond with an `actionResponse`.
   * Not yet implemented by this renderer.
   */
  wantResponse?: boolean;
  /** Unique identifier for correlating `actionResponse` messages. */
  actionId?: string;
  /** JSON Pointer path in the local data model to store the response value. */
  responsePath?: string;
}

/**
 * Action descriptor attached to interactive components (Button, CheckBox, …).
 *
 * Spec-compliant form:
 * ```json
 * { "event": { "name": "submit_form" } }
 * ```
 *
 * The legacy `id` field is kept for backward compatibility — the renderer
 * will fall back to it when `event.name` is not present — but new surfaces
 * should use `event.name`.
 */
export interface A2UIActionDescriptor {
  /** Spec-compliant server action event. */
  event?: A2UIActionEvent;
  /**
   * @deprecated Use `event.name` instead.
   * Kept for backward compatibility with surfaces created before the v1.0
   * conformance fix.
   */
  id?: string;
  /** @deprecated Not used. Previously listed data-model keys to include. */
  data?: string[];
}

export interface ButtonSpec extends ComponentCommon, CheckableComponent {
  component: "Button";
  child: string;
  action: A2UIActionDescriptor;
  variant?: ButtonVariant;
}

export type TextFieldVariant = "shortText" | "longText" | "number" | "obscured";

// ---------------------------------------------------------------------------
// Checks / validation (spec §checks)
// ---------------------------------------------------------------------------

/**
 * A single validation rule applied to an input component.
 * Spec §checks — evaluated before the action fires.
 */
export interface CheckRule {
  /** The validation function call (e.g. required, regex, email, length, numeric). */
  rule: FunctionCall;
  /** Error message shown to the user when the rule fails. */
  errorMessage: DynamicString;
}

export interface TextFieldSpec extends ComponentCommon, CheckableComponent {
  component: "TextField";
  label: DynamicString;
  value?: DynamicString;
  placeholder?: DynamicString;
  variant?: TextFieldVariant;
  /** Validation rules evaluated before dispatching an action (spec §checks). */
  checks?: CheckRule[];
  /** @deprecated Use `checks` with a `regex` rule instead. */
  validationRegexp?: string;
}

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
  name: string | PathRef;
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
  children: ChildList;
  direction?: "vertical" | "horizontal";
  align?: AlignValue;
}

export interface CardSpec extends ComponentCommon {
  component: "Card";
  child: string;
}

export interface TabsSpec extends ComponentCommon {
  component: "Tabs";
  tabs: { title: DynamicString; child: string }[];
}

export interface ModalSpec extends ComponentCommon {
  component: "Modal";
  trigger: string;
  content: string;
}

export interface DividerSpec extends ComponentCommon {
  component: "Divider";
  axis?: "horizontal" | "vertical";
}

export interface CheckBoxSpec extends ComponentCommon, CheckableComponent {
  component: "CheckBox";
  label: DynamicString;
  value: DynamicBoolean;
  action?: A2UIActionDescriptor;
}

export interface ChoicePickerOption {
  label: DynamicString;
  value: string;
}

export interface ChoicePickerSpec extends ComponentCommon, CheckableComponent {
  component: "ChoicePicker";
  label?: DynamicString;
  variant?: "multipleSelection" | "mutuallyExclusive";
  options: ChoicePickerOption[];
  value: DynamicStringList;
  displayStyle?: "checkbox" | "chips";
  filterable?: boolean;
}

export interface SliderSpec extends ComponentCommon, CheckableComponent {
  component: "Slider";
  label?: DynamicString;
  min?: number;
  max?: number;
  value: DynamicNumber;
  steps?: number;
}

export interface DateTimeInputSpec extends ComponentCommon, CheckableComponent {
  component: "DateTimeInput";
  value?: DynamicString;
  enableDate?: boolean;
  enableTime?: boolean;
  min?: DynamicString;
  max?: DynamicString;
  label?: DynamicString;
}

/** Union of all supported A2UI Basic catalog components. */
export type A2UIComponentSpec =
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

// ---------------------------------------------------------------------------
// Surface envelope types (A2UI v1.0 wire format)
// ---------------------------------------------------------------------------

/**
 * Server → Client: create a new surface.
 *
 * Spec §createSurface. The `components` array MUST contain one component with
 * `id: "root"` which serves as the root of the component tree.
 */
export interface A2UICreateSurface {
  /**
   * Protocol version. Must be `"v1.0"` for spec-compliant messages.
   * Optional to preserve backward compatibility with pre-conformance surfaces.
   */
  version?: "v1.0";
  type: "createSurface";
  surfaceId: string;
  catalogId: A2UICatalogId;
  /**
   * Flat array of component objects. The component with `id: "root"` is the
   * tree root. Relationships are expressed by ID references in `children`/`child`.
   */
  components: A2UIComponentSpec[];
  dataModel?: Record<string, unknown>;
  /**
   * If true, the client will include the full data model as metadata on every
   * outbound action message (spec §sendDataModel).
   */
  sendDataModel?: boolean;
  /** Display / branding properties for this surface (spec §surfaceProperties). */
  surfaceProperties?: Record<string, unknown>;
}

/**
 * Server → Client: add or replace components on an existing surface.
 *
 * Spec §updateComponents. Components are provided as a flat array.
 */
export interface A2UIUpdateComponents {
  /** Protocol version. Optional for backward compatibility. */
  version?: "v1.0";
  type: "updateComponents";
  surfaceId: string;
  components: A2UIComponentSpec[];
}

/**
 * Server → Client: update the data model at a specific path.
 *
 * Spec §updateDataModel. Replaces the value at `path` with `value`.
 * If `path` is omitted or `"/"`, the entire data model is replaced.
 * If `value` is omitted, the key at `path` is deleted.
 */
export interface A2UIUpdateDataModel {
  /** Protocol version. Optional for backward compatibility. */
  version?: "v1.0";
  type: "updateDataModel";
  surfaceId: string;
  /** JSON Pointer (RFC 6901). Defaults to `"/"` (replace entire model). */
  path?: string;
  value?: unknown;
}

/**
 * Server → Client: destroy a surface.
 */
export interface A2UIDeleteSurface {
  /** Protocol version. Optional for backward compatibility. */
  version?: "v1.0";
  type: "deleteSurface";
  surfaceId: string;
}

/**
 * Server → Client: invoke a renderer-side function.
 *
 * Spec §callFunction. The renderer evaluates the function and responds with
 * a `functionResponse` envelope. This enables server-triggered hardware
 * queries, async data fetches, or other client-side computations.
 */
export interface A2UICallFunction {
  version?: "v1.0";
  type: "callFunction";
  surfaceId: string;
  /** Unique call identifier used to correlate the response. */
  callId: string;
  /** The function call to evaluate on the client. */
  call: FunctionCall;
}

/**
 * Client → Server: result of a `callFunction` invocation.
 *
 * Spec §functionResponse.
 */
export interface A2UIFunctionResponse {
  version?: "v1.0";
  type: "functionResponse";
  surfaceId: string;
  callId: string;
  value: unknown;
  /** Set when the function evaluation failed. */
  error?: string;
}

/**
 * Server → Client: response to a `wantResponse` action.
 *
 * Spec §actionResponse. Delivered after the agent processes an action that
 * had `wantResponse: true`. The `responsePath` in the original action event
 * specifies where in the data model to store the response value.
 */
export interface A2UIActionResponse {
  version?: "v1.0";
  type: "actionResponse";
  surfaceId: string;
  /** Matches `A2UIActionEvent.actionId` of the triggering action. */
  actionId: string;
  value: unknown;
  /** JSON Pointer path where the renderer should store the response value. */
  responsePath?: string;
}

export type A2UIEnvelope =
  | A2UICreateSurface
  | A2UIUpdateComponents
  | A2UIUpdateDataModel
  | A2UIDeleteSurface
  | A2UICallFunction
  | A2UIActionResponse;

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

/**
 * Client → Server: user interaction event fired from a surface.
 *
 * Spec §action. `name` is the event name declared in the component's
 * `action.event.name`. The full current `dataModel` is included so the
 * agent always has the latest form state.
 */
export interface A2UIAction {
  type: "a2ui-action";
  surfaceId: string;
  /** The event name from the component's `action.event.name`. */
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

export interface A2UIFunctionResponseWirePart {
  kind: "a2ui-function-response";
  response: A2UIFunctionResponse;
}

// ---------------------------------------------------------------------------
// Client capabilities negotiation (spec §a2uiClientCapabilities)
// ---------------------------------------------------------------------------

/**
 * Advertised by the renderer to inform the agent which optional spec features
 * are supported. Sent as part of the initial handshake or Agent Card metadata.
 *
 * Spec §a2uiClientCapabilities.
 */
export interface A2UIClientCapabilities {
  /** Protocol version(s) the renderer supports. */
  versions: string[];
  /**
   * Catalog IDs the renderer has loaded.
   * Always includes the Basic catalog; may include additional catalogs.
   */
  catalogs: string[];
  /** Whether the renderer supports `callFunction` / `functionResponse`. */
  supportsCallFunction?: boolean;
  /** Whether the renderer supports the `checks` validation system. */
  supportsChecks?: boolean;
  /** Whether the renderer supports `@index` in data-driven children. */
  supportsIndexBuiltin?: boolean;
  /** Whether the renderer supports `actionResponse` envelopes. */
  supportsActionResponse?: boolean;
  /** Whether the renderer sends `sendDataModel` metadata on every action. */
  supportsSendDataModel?: boolean;
}
