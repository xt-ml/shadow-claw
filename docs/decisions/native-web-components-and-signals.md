# Native Web Components and TC39 Signals

**Status:** Active
**Date:** Early project — established in original architecture
**Commit:** `7d0540e` — co-located component assets introduced

## Context

Building a browser-native AI assistant requires a reactive UI that updates when async operations complete (streaming tokens, tool results, typing indicators). The question was: what framework (if any) to use?

The original options were:

1. **React/Vue/Svelte** — dominant in 2024–2025 web development
2. **Lit** — lightweight Web Component library with reactive properties
3. **Native Web Components + manual DOM** — pure standards, no library
4. **Native Web Components + TC39 Signals** — standards with reactive primitives

## Decision

Use **native Web Components** (Custom Elements + Shadow DOM) with **TC39 Signals** (`signal-polyfill`) for reactivity, connected via a small `effect()` helper.

### No framework, no Lit, no virtual DOM

Frameworks and Lit add weight and opinions. ShadowClaw's architecture has specific needs:

- **Worker message integration** — reactive updates drive from worker `postMessage` events, not React-style state setters
- **Shadow DOM isolation** — component styles must not leak across components
- **Fine-grained control** — the streaming bubble, smart auto-scroll, and toast timers all need precise lifecycle control that is cleaner with direct DOM manipulation

### Co-located component assets (2026-04-19 refinement)

Component templates (HTML) and stylesheets (CSS) are now co-located with the TypeScript source:

```text
src/components/shadow-claw-chat/
├── shadow-claw-chat.ts
├── shadow-claw-chat.html   ← fetched at runtime
└── shadow-claw-chat.css    ← adopted at runtime
```

The `ShadowClawElement` base class fetches these files at `connectedCallback()` time. Rollup's `copy` plugin mirrors them to `dist/public/` at build time.

**Why co-location?** Before this change, all component HTML was inline strings in JS files and all CSS was a single monolithic `index.css`. Co-location makes each component self-contained and easier to maintain/review. Shadow DOM isolation means component CSS can't interfere with the main stylesheet.

### TC39 Signals via `signal-polyfill`

The reactivity model is:

1. `Signal.State(value)` — mutable cell
2. `Signal.Computed(() => expr)` — derived value
3. `effect(callback)` — side effect that re-runs when dependencies change

This mirrors the Signal proposal's design intent. The polyfill will eventually be replaced by native browser `Signal` when the TC39 proposal lands.

**Why not an existing reactivity library (MobX, Solid.js signals)?**

- `signal-polyfill` is the reference implementation of the TC39 proposal — forward compatibility with native signals
- No virtual DOM, no reconciler, no diffing — direct DOM manipulation inside `effect()` callbacks
- Tiny surface area: one `effect()` primitive composes with everything

## Trade-offs

### Advantages

- **Zero framework runtime** — no React, Vue, or Lit bundle in production output
- **Standards-based** — Web Components, Shadow DOM, and Signals are platform APIs
- **Forward compatible** — TC39 Signals polyfill → native signals when browsers support it
- **Precise control** — components directly manipulate their shadow DOM, no reconciliation overhead
- **Isolated styles** — `adoptedStyleSheets` + Shadow DOM, no CSS specificity battles

### Disadvantages

- **More boilerplate** — no JSX, no template compiler. Templates are written as `.html` files fetched at runtime
- **Manual cleanup** — `effect()` disposers must be explicitly called in `disconnectedCallback()`
- **No server-side rendering** — Custom Elements require a browser environment
- **Less ecosystem** — fewer off-the-shelf components, though the component set is small and domain-specific

## Alternatives Considered

| Alternative         | Why not chosen                                                               |
| ------------------- | ---------------------------------------------------------------------------- |
| React               | Bundle size, runtime cost, not browser-native                                |
| Lit                 | Adds a reactive property layer that would conflict with the Signals approach |
| Vue                 | Framework conventions would conflict with the direct DOM manipulation model  |
| innerHTML templates | Harder to maintain, doesn't separate concerns (HTML/CSS/TS)                  |
| Inline HTML strings | Unmaintainable at scale; no syntax highlighting in editors                   |

## Impact

- Every page is a `<shadow-claw-*>` Custom Element extending `ShadowClawElement`
- All reactive state lives in `src/stores/` as Signal.State instances
- UI updates happen inside `effect()` callbacks in `setupEffects()`
- Components import `effect` and stores only — never manipulate state directly
