# Pages System

> Workspace-relative pages rendering and sidebar navigation.

**Source:** `src/components/shadow-claw-pages/shadow-claw-pages.ts` · `src/stores/orchestrator.ts`

## Overview

ShadowClaw includes a Pages sidebar for organizing and viewing workspace content. It allows users to render markdown and HTML files as structured previews.

Links and images in pages resolve relative to the workspace. The page state persists across sessions, and users can configure a default starting page.

---

## Architecture Overview

```mermaid
graph TD
  "User / UI" --> "shadow-claw-pages"
  "shadow-claw-pages" --> "orchestratorStore"
  "orchestratorStore" --> "CONFIG_KEYS.PAGES_LIST (DB)"

  "shadow-claw-pages" -- "Markdown" --> "renderMarkdown()"
  "renderMarkdown()" --> "DOMPurify + Image Data URL Conversion"

  "shadow-claw-pages" -- "HTML" --> "Iframe srcdoc"
  "Iframe srcdoc" --> "sanitizeSrcdocHtml()"
  "Iframe srcdoc" --> "file-viewer-preview-bridge.js"
  "file-viewer-preview-bridge.js" -- "postMessage" --> "shadow-claw-pages"
```

---

## State Management (`src/stores/orchestrator.ts`)

The list of saved pages and the currently active page are managed centrally by the orchestrator:

- `_pages`: A `Signal.State` holding the array of `SavedPageRef` objects.
- `_activePinnedPage`: The currently active page reference.

The pages list is persisted to IndexedDB under the `CONFIG_KEYS.PAGES_LIST` key. If the list is empty at startup, the system automatically attempts to seed a default workspace readme (e.g., `docs/README.md`) if it exists.

---

## Component Logic (`src/components/shadow-claw-pages/shadow-claw-pages.ts`)

The `shadow-claw-pages` web component handles rendering the UI and displaying the file previews. It handles files differently based on their extension:

### Markdown (`.md`, `.markdown`)

1. Rendered to HTML via `renderMarkdown()`.
2. Link paths (`a[href]`) are rewritten to resolve against the active workspace route.
3. Images (`img[src]`) with relative workspace paths are fetched from OPFS via `readGroupFileBytes()`, converted to `Blob` data URLs based on their mime type, and injected back into the HTML.
4. Content is sanitized using `setSanitizedHtml` and a custom `DOMPurify` configuration (`previewSanitizeOptions`) that specifically allows `blob:` URIs.

### HTML (`.html`, `.xhtml`)

1. The raw HTML content is wrapped in a full document structure and sanitized via `sanitizeSrcdocHtml`.
2. It is rendered inside a sandboxed `iframe` using `setTrustedSrcdoc`.
3. To prevent XSS, inline scripts and external scripts are blocked using a nonce-gated Content Security Policy (CSP).
4. The only permitted script is `file-viewer-preview-bridge.js`. This bridge script intercepts navigation inside the iframe and sends a `shadow-claw-file-viewer-link` `postMessage` to the parent component, which processes the navigation safely via the browser History API.

---

## Agent Capabilities

The Pages system is entirely driven by the user interface and UI interactions. There are no direct agent-facing tools (e.g., `pin_page`) exposed to the LLM for managing the Pages sidebar. Agents can indirectly affect pages by writing to the underlying Markdown or HTML files via standard file manipulation tools.
