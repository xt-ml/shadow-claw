# Pages System

> Workspace-relative pages rendering and sidebar navigation.

**Source:** `src/components/shadow-claw-pages/shadow-claw-pages.ts` · `src/stores/orchestrator.ts` · `src/storage/staticMainSite.ts` · `src/storage/suppressedPages.ts`

## Overview

ShadowClaw includes a Pages sidebar for organizing and viewing workspace content. It allows users to render markdown and HTML files as structured previews.

Links and images in pages resolve relative to the workspace. The page state persists across sessions, and the top item in the page list serves as the default page when selecting root Pages.

Markdown pages can optionally surface YAML frontmatter as a visible metadata block before the rendered content. HTML previews use a configurable iframe host allowlist so embedded content stays constrained to trusted hosts.

---

## Architecture Overview

```mermaid
graph TD
  "User / UI" --> "shadow-claw-pages"
  "shadow-claw-pages" --> "orchestratorStore"
  "orchestratorStore" --> "CONFIG_KEYS.PAGES_LIST (DB)"
  "orchestratorStore" --> "seedStaticMainSite()"
  "seedStaticMainSite()" --> "suppressedPages (DB)"

  "shadow-claw-pages" -- "Markdown" --> "renderMarkdown()"
  "renderMarkdown()" --> "DOMPurify + Image Data URL Conversion"

  "shadow-claw-pages" -- "HTML" --> "Iframe srcdoc"
  "Iframe srcdoc" --> "sanitizeSrcdocHtml()"
  "Iframe srcdoc" --> "file-viewer-preview-bridge.js"
  "file-viewer-preview-bridge.js" -- "postMessage" --> "shadow-claw-pages"
  "shadow-claw-pages" -- "shadow-claw-navigate" --> "Browser History API"
```

---

## State Management & Storage (`src/stores/orchestrator.ts`)

The list of saved pages, default pinned page, and active page are managed centrally by the orchestrator:

- `_pages`: A `Signal.State` holding the array of `SavedPageRef` objects.
- `_activePinnedPage`: The currently active page reference.
- `_defaultPinnedPage`: The default pinned page reference set by the user or top item.
- `effectiveDefaultPage`: Computed property returning the top item in the pages list or `null`.

### Static Main Site Seeding (`src/storage/staticMainSite.ts`)

During store initialization, `seedStaticMainSite()` seeds default main workspace pages:

1. Manifest discovery checks `#shadow-claw-static-manifest` JSON script elements or fetches `static-main-manifest.json`.
2. Automatically ensures `MEMORY.md` and default static workspace pages exist unless they are marked as suppressed.

### Page Suppression (`src/storage/suppressedPages.ts`)

To prevent deleted static pages from re-appearing on reload:

- Deleted pages are recorded in IndexedDB under `CONFIG_KEYS.SUPPRESSED_PAGES_LIST`.
- `isPageSuppressed()`, `suppressPage()`, and `unsuppressPage()` manage page suppression status.
- Re-adding a page unsuppresses it, allowing it to be persisted normally.

---

## Component Logic (`src/components/shadow-claw-pages/shadow-claw-pages.ts`)

The `shadow-claw-pages` web component handles rendering the UI and displaying file previews:

### Navigation & URL State Synchronization

- **URL Sync**: Selecting or reordering pages dispatches navigation events (`shadow-claw-navigate`) and updates browser URL history via `history.pushState()`, preserving active page state across refreshes.
- **Pinned Home Page & Reordering**: Users can reorder pages via drag-and-drop or star indicators. The top page acts as the pinned home page (`effectiveDefaultPage`).
- **Responsive Viewport**: On mobile viewports, the sidebar supports toggle collapse (`pages__content--sidebar-collapsed`).
- **Confirmation Modals**: Destructive page removals render standardized confirmation dialogs consistent with workspace UI dialogs.

### Content Rendering

#### Markdown (`.md`, `.markdown`)

1. Rendered to HTML via `renderMarkdown()`.
2. YAML frontmatter is parsed from the document head and can be rendered as a visible metadata/details block when the relevant Settings toggle is enabled.
3. Link paths (`a[href]`) are rewritten to resolve against the active workspace route.
4. Images (`img[src]`) with relative workspace paths are fetched from OPFS via `readGroupFileBytes()`, converted to `Blob` data URLs based on their mime type, and injected back into the HTML.
5. Content is sanitized using `setSanitizedHtml` and a custom `DOMPurify` configuration (`previewSanitizeOptions`) that specifically allows `blob:` URIs.

#### HTML (`.html`, `.xhtml`)

1. The raw HTML content is wrapped in a full document structure and sanitized via `sanitizeSrcdocHtml`.
2. It is rendered inside a sandboxed `iframe` using `setTrustedSrcdoc`.
3. To prevent XSS, inline scripts and external scripts are blocked using a nonce-gated Content Security Policy (CSP).
4. A DOMPurify iframe hook removes unsafe embeds and only preserves iframe `src` values that match the Settings-backed host allowlist.
5. The only permitted script is `file-viewer-preview-bridge.js`. This bridge script intercepts navigation inside the iframe and sends a `shadow-claw-file-viewer-link` `postMessage` to the parent component, which processes the navigation safely via the browser History API.

### Frontmatter and Embed Settings

- `CONFIG_KEYS.MARKDOWN_FRONTMATTER_PAGES`, `CONFIG_KEYS.MARKDOWN_FRONTMATTER_FILE_VIEWER`, `CONFIG_KEYS.MARKDOWN_FRONTMATTER_CHAT`, and `CONFIG_KEYS.MARKDOWN_FRONTMATTER_TASKS` control where frontmatter is rendered.
- `CONFIG_KEYS.ALLOWED_IFRAME_HOST_PATTERNS` stores the iframe host allowlist used by markdown and HTML previews.
- Allowlist entries can be plain domains, wildcard domains, or regex patterns; the default list covers common YouTube and ShadowClaw-hosted embeds.

---

## Pre-rendered Content Override (`OVERRIDE_PRERENDER_SKELETON`)

Applications pre-rendered with Declarative Shadow DOM (DSD) shell via `bin/prerender-dsd-shell.mjs` can override initial pre-rendered page content:

- Enabled via the "Override pre-rendered content" toggle in Settings (`CONFIG_KEYS.OVERRIDE_PRERENDER_SKELETON`).
- Hides the initial DSD shell on boot, showing the skeleton loader until hydration finishes to eliminate visual flashes.

---

## Agent Capabilities

The Pages system is primarily driven by the user interface and UI interactions. There are no direct agent-facing tools (e.g., `pin_page`) exposed to the LLM for managing the Pages sidebar. Agents can indirectly affect pages by writing to the underlying Markdown or HTML files via standard file manipulation tools (`write_file`, `patch_file`).
