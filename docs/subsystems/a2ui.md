# A2UI Interactive Surfaces

ShadowClaw implements **A2UI v1.0**, a specification for agents to render interactive UI surfaces directly in conversations.

## Overview

A2UI enables rich, responsive interfaces beyond plain text:

- **Component-based**: Text, Button, TextField, Row, Column layouts
- **Reactive data binding**: Two-way binding between components and a data model
- **PeerJS delivery**: Surfaces are rendered inline via WebRTC peer connections
- **Catalog system**: Minimal (5 components) and Basic (14 components) official catalogs
- **Action-driven**: User interactions (clicks, form inputs) update the data model and route back to the originating agent

## Architecture

```
Agent Tool (render_component)
    → A2UI Envelope (action, surface spec)
    ↓
PeerJS WebRTC Channel
    ↓
<shadow-claw-a2ui> Web Component
    ↓
Interactive UI rendered in conversation
    ↓
User interaction (click, input)
    → Data model update
    → Route back to originating agent
```

## Catalogs

### Minimal Catalog

**Catalog ID:** `https://a2ui.org/specification/v1_0/catalogs/minimal/catalog.json`

**Components:**

- `Text` — Static text with optional variant (h1, h2, h3, h4, h5, caption, body)
- `Row` — Horizontal flexbox container
- `Column` — Vertical flexbox container
- `Button` — Interactive button with action binding
- `TextField` — Text input with optional validation and two-way binding

**Functions:**

- `capitalize` — String transformation function

### Basic Catalog

**Catalog ID:** `https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json`

**Additional components:**

- `Image` — Render images from workspace or HTTPS URLs
- `Icon` — Material Design or custom SVG icons
- `Video` — Video player (workspace or HTTPS)
- `AudioPlayer` — Audio playback control
- `List` — Scrollable list of items
- `Card` — Container with shadow and padding
- `Tabs` — Tabbed interface
- `Modal` — Dialog overlay
- `Divider` — Visual separator
- `CheckBox` — Checkbox input
- `ChoicePicker` — Radio or multi-select choice control
- `Slider` — Range input
- `DateTimeInput` — Date/time picker

## Tools

### `list_components`

Returns a human-readable reference of all available components, their schemas, and example compositions.

**Input:** None required

**Output:** Formatted reference guide for Minimal and Basic catalogs

### `render_component`

Render or update an interactive A2UI surface in the conversation.

**Actions:**

- `createSurface` — Render a new surface
  - Required: `rootComponentId`, `components` (map of component ID → spec)
  - Optional: `catalogId` (defaults to minimal), `dataModel`
- `updateComponents` — Patch specific components on an existing surface
  - Required: `surfaceId`, `components`
- `updateDataModel` — Update data model values (triggers re-render of bound components)
  - Required: `surfaceId`, `patches`
- `deleteSurface` — Remove surface from conversation
  - Required: `surfaceId`

**Media property resolution:**

- `image.url`, `image.src`, `image.imageUrl` — all accepted
- Workspace file paths: `song.mp3`, `./file.mp4`
- HTTPS URLs: `https://example.com/image.png`

## Data Binding

### Dynamic Strings

Components use **dynamic strings** for reactive properties:

- **Literal value:** `"Hello"`
- **Data model reference:** `{ "$dataModel": "/name" }`
- **Function call:** `{ "call": "capitalize", "args": { "value": { "$dataModel": "/firstName" } } }`

### Two-way Binding

TextField components with `value` property automatically bind to the data model:

```json
{
  "id": "nameField",
  "kind": "TextField",
  "label": "Your name:",
  "value": { "$dataModel": "/name" },
  "variant": "shortText"
}
```

When the user types, the data model updates and is routed back to the agent.

## Web Component

**Tag:** `<shadow-claw-a2ui>`

**Public API:**

```typescript
applyEnvelope(envelope: A2UIEnvelope): void
  Apply an A2UI envelope (createSurface, updateComponents, updateDataModel, deleteSurface)

getSurface(): SurfaceState | null
  Retrieve current surface state

getSurfaceId(): string
  Get the current surface ID

getRootComponentId(): string
  Get the root component ID
```

**Properties:**

- `groupId` — The conversation group ID this surface belongs to (set by chat component)

## Integration Points

### Chat Component (`shadow-claw-chat`)

When the orchestrator receives an `a2ui-surface` event:

1. Extract the A2UI envelope
2. Pass to `<shadow-claw-a2ui>.applyEnvelope(envelope)`
3. Surface renders inline in the message flow

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
[channels.md](channels.md) and `src/channels/peer-protocol.ts`).

**Limitation:** Late joiners do not receive a replay of surfaces created before
they joined; the owner must re-render to include them.

## Media Resolution

Images, videos, and audio are resolved from:

1. **Workspace files** — e.g., `photo.jpg` (resolved relative to conversation workspace)
2. **HTTPS URLs** — e.g., `https://example.com/image.png`
3. **OPFS** — Via `readGroupFileBytes` helper

## Best Practices

- **Use `list_components` first** — Agents should call this before designing surfaces to understand available components
- **Flatten component trees** — Pass a flat `components` map with IDs, not nested specs
- **Validate inputs** — Use `variant` and `validationRegexp` for TextField validation
- **Responsive layouts** — Leverage Row/Column `justify` and `align` properties for flexible layouts
- **Data model scoping** — Keep data models simple; use top-level keys for two-way binding paths
- **Catalog selection** — Start with minimal catalog; upgrade to basic only if needed for specific components

## Testing

E2E tests for A2UI rendering and interaction patterns are located in `e2e/` and use Playwright to verify:

- Surface creation and component rendering
- Data model updates and binding
- User interactions (clicks, form input)
- Surface deletion and cleanup
