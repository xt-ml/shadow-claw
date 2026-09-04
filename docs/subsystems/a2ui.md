# A2UI Interactive Surfaces

ShadowClaw implements **A2UI v1.0**, a specification for agents to render interactive UI surfaces directly in conversations.

## Overview

A2UI enables rich, responsive interfaces beyond plain text:

- **Component-based**: 18 Basic catalog components (Text, Button, TextField, Row, Column, Image, Icon, Video, AudioPlayer, List, Card, Tabs, Modal, Divider, CheckBox, ChoicePicker, Slider, DateTimeInput)
- **Reactive data binding**: Two-way binding between components and a data model using `{ "path": "/key" }` syntax (RFC 6901 JSON Pointer)
- **Transport**: Surfaces are delivered locally, via WebRTC peer connections, or broadcast to multi-party rooms
- **Single catalog**: The Basic catalog — the only official A2UI v1.0 catalog
- **Action-driven**: User interactions (clicks, form inputs) update the data model and route back to the originating agent
- **Function registry**: Pluggable `FunctionRegistry` and `CatalogRegistry` singletons power data-binding functions and future catalog extensions

## Architecture

```
Agent Tool (render_component)
    → A2UIEnvelope (version:"v1.0", type, components array, ...)
    ↓
PeerJS WebRTC Channel / local emit
    ↓
<shadow-claw-a2ui> Web Component
    → normaliseComponentsToMap() — flat array → keyed map for O(1) lookup
    ↓
Component registry dispatch (globalComponentRegistry)
    → renderText / renderButton / renderList … (catalog/basic/)
    → resolveChildIds() — static IDs or data-driven template expansion
    → buildItemDataScope() — per-item @index / @item scope injection
    ↓
Interactive UI rendered in conversation
    ↓
User interaction (click, input)
    → Data model update
    → Route back to originating agent as [A2UI ACTION]

Agent callFunction request
    → <shadow-claw-a2ui> dispatches globalFunctionRegistry.execute()
    → fires shadow-claw-a2ui-function-response custom event
    → shadow-claw-chat routes functionResponse back to peer channel
```

## Module Layout

The A2UI runtime lives under `src/ui/a2ui/`:

```
src/ui/a2ui/
├── types.ts                    # All A2UI types, constants, and BASIC_CATALOG_REFERENCE
├── a2ui.test.ts                # Module-level integration tests
├── types.test.ts               # Type guard / constant tests
├── registries/
│   ├── CatalogRegistry.ts      # Registry of catalog definitions (UAX #31 validation)
│   ├── ComponentRegistry.ts    # Registry of component render callbacks
│   ├── FunctionRegistry.ts     # Registry of callable functions with boundary enforcement
│   └── basicFunctions.ts       # Registers all Basic catalog functions into globalFunctionRegistry
└── utils/
    ├── applyDataModelUpdate.ts  # Spec §updateDataModel: single path+value JSON Pointer write
    ├── buildItemDataScope.ts    # Spec §builtins: @index / @item per-item scope
    ├── evaluateCheckRule.ts     # Spec §checks: CheckRule validation evaluation
    ├── formatA2UIActionPrompt.ts # [A2UI ACTION] prompt builder
    ├── normaliseComponentsToMap.ts # Flat array → keyed Record for O(1) render lookup
    ├── resolveChildIds.ts       # Spec §DataDrivenChildren: static IDs + template expansion
    ├── resolveDynamicBoolean.ts # Dynamic boolean resolution (PathRef / literal / fn call)
    ├── resolveDynamicNumber.ts  # Dynamic number resolution
    ├── resolveDynamicString.ts  # Dynamic string resolution (PathRef / $dataModel / fn call)
    └── resolveJsonPointer.ts   # RFC 6901 JSON Pointer read
```

The catalog renderers live under `src/components/shadow-claw-a2ui/catalog/basic/`:

```
catalog/basic/
├── shared.ts              # Shared helpers used by multiple catalog renderers
├── text.ts / button.ts / row.ts / column.ts / text-field.ts
├── image.ts / icon.ts / video.ts / audio-player.ts
├── list.ts / card.ts / tabs.ts / modal.ts / divider.ts
├── checkbox.ts / choice-picker.ts / slider.ts / date-time-input.ts
└── *.test.ts              # Co-located unit tests for each renderer
```

## Catalog

### Basic Catalog

**Catalog ID:** `https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json`

This is the only official A2UI v1.0 catalog. There is no "Minimal" catalog in the spec —
that was a proprietary subset that has been removed.

**Components:**

- `Text` — Static or bound text with optional variant (h1, h2, h3, h4, h5, caption, body)
- `Row` — Horizontal flexbox container
- `Column` — Vertical flexbox container
- `Button` — Interactive button with action binding
- `TextField` — Text input with optional two-way binding
- `Image` — Render images from workspace or HTTPS URLs
- `Icon` — Material Design or custom SVG icons
- `Video` — Video player (workspace or HTTPS)
- `AudioPlayer` — Audio playback control
- `List` — Scrollable list of items; supports data-driven template expansion
- `Card` — Container with shadow and padding
- `Tabs` — Tabbed interface
- `Modal` — Dialog overlay
- `Divider` — Visual separator
- `CheckBox` — Checkbox input
- `ChoicePicker` — Radio or multi-select choice control
- `Slider` — Range input
- `DateTimeInput` — Date/time picker

**Functions (data binding):**

Registered into `globalFunctionRegistry` by `registerBasicFunctions()`:

- `capitalize` — String transformation (ShadowClaw extension; not in official spec)
- `formatString` — String interpolation with `${/pointer}` syntax
- `formatNumber` — Locale-aware number formatting
- `formatCurrency` — Currency formatting
- `formatDate` — Unicode TR35 date pattern formatting
- `pluralize` — CLDR plural-aware string selection
- `openUrl` — Open a URL (action function)
- `required`, `regex`, `length`, `numeric`, `email` — Validation (used in `checks` rules)
- `and`, `or`, `not` — Logical combinators

## Tools

### `list_components`

Returns a human-readable reference of all available components, their schemas, and example compositions.

**Input:** None required

**Output:** `BASIC_CATALOG_REFERENCE` constant from `src/ui/a2ui/types.ts` — a formatted reference for the Basic catalog

### `render_component`

Render or update an interactive A2UI surface in the conversation.

**Actions:**

- `createSurface` — Render a new surface
  - Required: `components` (flat array; one must have `id: "root"`)
  - Optional: `dataModel`, `surfaceProperties`, `sendDataModel`
- `updateComponents` — Add or replace components on an existing surface
  - Required: `surfaceId`, `components` (array)
- `updateDataModel` — Update a single path in the data model (re-renders bound components)
  - Required: `surfaceId`, `path` (JSON Pointer), `value`
- `deleteSurface` — Remove surface from conversation
  - Required: `surfaceId`

**Input normalisation (`executeRenderComponent`):**

The tool executor accepts two component formats and normalises both to a spec-compliant flat array before emitting the envelope:

1. **Array** (spec-compliant): `[{id:"root",component:"Column",...}, ...]`
2. **Map** (deprecated): `{"root":{component:"Column",...}, ...}` — converted to array, stamping map key as `id`

Any nested `properties` sub-object is merged flat automatically (LLM workaround).

**Media property resolution:**

- `image.url`, `image.src`, `image.imageUrl` — all accepted
- Workspace file paths: `song.mp3`, `./file.mp4`
- HTTPS URLs: `https://example.com/image.png`

## Data Binding

### Dynamic Values

Components use **dynamic values** for reactive properties. A property can be:

- **Literal value:** `"Hello"`
- **Data model reference (spec-canonical):** `{ "path": "/name" }` — JSON Pointer (RFC 6901)
- **Function call:** `{ "call": "capitalize", "args": { "value": { "path": "/firstName" } } }`

The legacy `{ "$dataModel": "/key" }` form is still resolved by the runtime but is
**deprecated** — new surfaces should use `{ "path": "/key" }`.

### Components Array Format

All components are specified as a **flat array**. Each object must have an `id` field.
One component must have `id: "root"` to serve as the tree root. Child relationships
are expressed by referencing other component IDs.

```json
[
  { "id": "root", "component": "Column", "children": ["title", "form"] },
  { "id": "title", "component": "Text", "text": { "path": "/heading" } },
  { "id": "form", "component": "Row", "children": ["field"] },
  {
    "id": "field",
    "component": "TextField",
    "label": "Name",
    "value": { "path": "/name" }
  }
]
```

### Data-Driven Children (`resolveChildIds`)

`Row`, `Column`, and `List` children can be **data-driven** using a template descriptor
instead of a static ID array:

```json
{
  "id": "list",
  "component": "List",
  "children": { "path": "/items", "componentId": "item_tmpl" }
}
```

`resolveChildIds()` reads the list at `/items` in the data model and generates synthetic
IDs `item_tmpl_0`, `item_tmpl_1`, … The renderer clones the template spec for each slot
and injects a `ScopeContext` so that `{ "path": "/@index" }` and `{ "path": "/@item" }`
resolve to the per-item index and value (spec §builtins).

`buildItemDataScope()` constructs this scope by merging the surface data model with
`@index` and `@item` for each iteration.

### `updateDataModel` Format

Use a single `path` + `value` per call (spec §updateDataModel):

```json
{
  "action": "updateDataModel",
  "surfaceId": "my-surface",
  "path": "/result",
  "value": "Hello World"
}
```

To update multiple fields, call `render_component` once per field. If `path` is `"/"` or
omitted, the entire data model is replaced. If `value` is omitted, the key at `path` is deleted.

The deprecated `patches` map (multi-key) is still accepted by the executor for backward
compatibility via `applyDataModelPatches`, but new agent code should use `path`/`value`.

### Action Model

Buttons and other interactive components declare actions using the spec-compliant form:

```json
{
  "id": "submit_btn",
  "component": "Button",
  "child": "submit_lbl",
  "action": { "event": { "name": "submit_form" } }
}
```

When the user clicks, the component fires an `[A2UI ACTION]` prompt (built by
`formatA2UIActionPrompt`) containing:

- `surfaceId` — the surface that received the interaction
- `actionId` — the event name (`action.event.name`)
- `dataModel` — the full current form state

The agent should then call `render_component` with `updateDataModel` to update the surface.

The deprecated `action.id` field is still handled by the renderer for backward compatibility.

### `sendDataModel` Flag

When the agent sets `sendDataModel: true` in `createSurface`, every action dispatch
includes the complete current data model. When `false` (default), the data model is still
sent (current behaviour); a future optimisation may omit unchanged keys.

## Web Component

**Tag:** `<shadow-claw-a2ui>`

**Public API:**

```typescript
applyEnvelope(envelope: A2UIEnvelope): void
  Apply an A2UI envelope (createSurface, updateComponents, updateDataModel,
  deleteSurface, actionResponse, callFunction)

getSurfaceId(): string | null
  Get the current surface ID
```

**Properties:**

- `groupId` — The conversation group ID this surface belongs to (set by chat component)

**Envelope handlers:**

| Envelope type      | Behaviour                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `createSurface`    | Normalises component array → map, sets `#sendDataModel`, renders surface                     |
| `updateComponents` | Merges normalised array into existing component map, re-renders                              |
| `updateDataModel`  | Calls `applyDataModelUpdate(path, value)`, re-renders                                        |
| `deleteSurface`    | Clears surface state and DOM                                                                 |
| `actionResponse`   | Stores `value` at `responsePath` via `applyDataModelUpdate`, re-renders                      |
| `callFunction`     | Executes via `globalFunctionRegistry`, dispatches `shadow-claw-a2ui-function-response` event |

**`callFunction` / `functionResponse` round-trip:**

1. Agent sends a `callFunction` envelope with `call.call`, `call.args`, and a `callId`.
2. The web component executes the function via `globalFunctionRegistry`.
3. It dispatches `shadow-claw-a2ui-function-response` (bubbles, composed) with `{ groupId, response }`.
4. `shadow-claw-chat` listens for this event and routes the `functionResponse` envelope back to the peer channel.

**Rendering context — `ScopeContext`:**

`#renderComponent(id, surface, scopeContext?)` accepts an optional `ScopeContext`
(defined in `src/components/types.ts`) that carries per-item data for template rendering
inside data-driven `List` / `Row` / `Column` children. The scope contains the resolved
data model for that iteration slot (including `@index` and `@item`).

## Integration Points

### Chat Component (`shadow-claw-chat`)

- Listens for `shadow-claw-a2ui-function-response` events and routes `functionResponse`
  envelopes back to the correct peer channel.
- Passes A2UI envelopes from the orchestrator to `<shadow-claw-a2ui>.applyEnvelope()`.

### Orchestrator

The orchestrator listens for A2UI envelopes in worker responses and emits `a2ui-surface` events to the chat component.

### PeerJS Channel

The `peerjs` channel handler processes A2UI envelopes as `kind: "a2ui"` message parts and routes them to the UI.

## Shared Room Surfaces (multi-party)

In a 1:1 `peer:` conversation a surface is delivered to the single remote peer
via `sendA2UI` / `sendA2UIAction`. In a multi-party `room:` conversation,
surfaces are **broadcast to every member** so all agents and humans interact
with the same surface simultaneously. This is **owner-authoritative**:

- **Ownership:** Whichever agent calls `render_component` in a room owns the
  surface. The `RoomManager` records `surfaceId → ownerPeerId`.
- **Surface broadcast (`room/a2ui`):** When the owner renders or updates a
  surface, the orchestrator broadcasts the envelope to all members over the
  room mesh (with host-relay fallback and `broadcastId` de-duplication). Every
  member's `<shadow-claw-a2ui>` applies the same envelope.
- **Action broadcast (`room/a2ui-action`):** When **any** member clicks a
  button (or submits input), the action is routed by
  `Orchestrator.routeRoomA2UIAction`. If the local peer owns the surface it
  processes the action directly; otherwise the action is broadcast so the
  owner's agent receives it.
- **Synchronized state:** Only the owner's agent mutates the data model. It
  emits an `[A2UI ACTION]` trigger prompt (built by `formatA2UIActionPrompt`),
  calls `render_component` with `updateDataModel`, and that update is broadcast
  back to the room — keeping every member's surface in lockstep. Non-owners
  never process actions for surfaces they do not own (enforced against the
  local ownership map, so a peer cannot hijack a surface it did not create).

**Wire methods:** `room/a2ui` and `room/a2ui-action` (see
[channels.md](channels.md) and `src/subsystems/channels/peer-protocol.ts`).

**Limitation:** Late joiners do not receive a replay of surfaces created before
they joined; the owner must re-render to include them.

## Media Resolution

Images, videos, and audio are resolved from:

1. **Workspace files** — e.g., `photo.jpg` (resolved relative to conversation workspace)
2. **HTTPS URLs** — e.g., `https://example.com/image.png`
3. **OPFS** — Via `readGroupFileBytes` helper

## Best Practices

- **Use `list_components` first** — Agents should call this before designing surfaces
- **Always include `id: "root"`** — The root component must have this exact id
- **Use `{ "path": "/key" }` for data binding** — This is the spec-canonical form
- **One `updateDataModel` call per field** — Use `path` + `value`; send separate calls for each field
- **Flatten component arrays** — Pass a flat array with IDs; children reference sibling IDs
- **Use `action: { "event": { "name": "myAction" } }`** — Spec-compliant action descriptor
- **Use `formatString` for string interpolation** — `{ "call": "formatString", "args": { "value": "Hello ${/name}" } }`

## Known Gaps vs. A2UI v1.0 Spec

| Feature                                        | Spec Reference      | Status                                                                                    |
| ---------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `checks` validation on inputs (UI enforcement) | §checks             | Types defined via `CheckRule`; `evaluateCheckRule` implemented; UI blocking not yet wired |
| `a2uiClientCapabilities` negotiation           | §clientCapabilities | `A2UIClientCapabilities` type defined; handshake not yet sent                             |
| `functionResponse` routing in rooms            | §callFunction       | Single-agent rooms only; multi-owner room routing not yet implemented                     |

## Testing & Storybook Workbench

### Unit & E2E Testing

Unit tests for individual utilities and catalog renderers live next to their source files
(`*.test.ts`) and run via Jest. E2E tests for A2UI rendering and interaction patterns are
located in `e2e/` and use Playwright to verify:

- Surface creation and component rendering
- Data model updates and binding
- User interactions (clicks, form input)
- Surface deletion and cleanup
- Dynamic list / template expansion with `@index` scope

### Storybook Workbench (`npm run storybook`)

All 18 Basic catalog components are comprehensively covered with interactive Storybook stories in `src/components/shadow-claw-a2ui/shadow-claw-a2ui.stories.ts`. The workbench verifies:

- Surface container layout and styling across light and dark modes
- Component rendering for Text, Button, TextField, Row, Column, Image, Icon, Video, AudioPlayer, List, Card, Tabs, Modal, Divider, CheckBox, ChoicePicker, Slider, and DateTimeInput
- Interactive state inspection, controls, and data binding examples without requiring active LLM sessions or peer connections
