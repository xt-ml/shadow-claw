# Theming, Stylesheets & Layout Customization

> Architecture, configuration, and styling patterns for theming ShadowClaw sites, customizing layout tokens, and styling slotted components across light and shadow DOM boundaries.

---

## Overview

ShadowClaw provides a layered theming and templating system designed for both standalone AI assistant deployments and published static documentation hubs or personal sites. The styling architecture operates across two distinct DOM domains:

1. **Shadow DOM (Component Internals)**:
   - Built-in web components (`<shadow-claw>`, `<shadow-claw-pages>`, `<shadow-claw-chat>`, `<shadow-claw-dialog>`, etc.) render inside open Shadow Roots with pre-rendered Declarative Shadow DOM (DSD) templates.
   - These components are insulated from external CSS rules, but inherit and reflect global **CSS Custom Properties** (`--shadow-claw-*`).
2. **Light DOM (Slotted Content & Custom Shell)**:
   - Slotted elements injected into named slots (`slot="sidebar"`, `slot="sidebar-nav"`, `slot="sidebar-content"`, `slot="sidebar-footer"`, `slot="header-actions-logo"`, `slot="logo"`) live directly in the host page's Light DOM.
   - These elements are styled using standard CSS selectors defined in the site's custom stylesheet (`theme.stylesheet`).

---

## Configuration (`shadow-claw.config.json`)

Custom theming is declared in the root configuration file (`shadow-claw.config.json` or legacy `site-config.json`):

```json
{
  "theme": {
    "stylesheet": "pages/main/theme.css"
  },
  "sidebar": {
    "pagesHidden": true,
    "chatHidden": true,
    "tasksHidden": true,
    "filesHidden": true,
    "defaultPage": "pages"
  },
  "branding": {
    "titleText": "My Custom Site",
    "faviconPath": "pages/resources/favicon.ico",
    "appleTouchIconPath": "pages/resources/icon-192x192.png",
    "logoSlotHtml": "none"
  }
}
```

Setting `branding.logoSlotHtml` to `"none"`, `""`, or `null` strips the default header logo markup and removes the left margin on `.header-title`.

### `theme.stylesheet`

- **Build-Time Processing**: When `theme.stylesheet` is defined:
  - `src/cli/site-config/apply.ts` locates the source stylesheet.
  - The stylesheet is copied into the distribution directory (`dist/public/`).
  - An HTML link tag (`<link rel="stylesheet" href="..." />`) is injected immediately before the closing `</head>` in `dist/public/index.html` and across all pre-rendered pretty path `index.html` files.
- **Path Resolution & Asset Flattening**:
  - Stylesheets located in resource folders (`pages/resources/`, `pages/deps/`, `resources/`, `deps/`, `pages/assets/`, or `pages/main/assets/`) are flattened to the root of the distribution directory, and their href prefix is automatically resolved.
  - Custom paths such as `pages/main/theme.css` retain their posix path relative to `<base href="/">`.
  - External stylesheets starting with `http://`, `https://`, or `//` are preserved verbatim.

### Inline Theme Stylesheets (`<style id="shadow-claw-theme">`)

For standalone single-file applications and embedded custom element deployments, custom theme styles and utility classes can be declared inline without requiring external `.css` files:

- **Host Document Declaration**: Place a `<style id="shadow-claw-theme">` (or `<style data-shadow-claw-theme>`) block in the `<head>` of your document.
- **Custom Style ID**: If using an alternate element ID, declare `"theme": { "styleElement": "my-custom-theme-id" }` in your site configuration.
- **Shadow DOM Injection**: `<shadow-claw-pages>` automatically inspects the document for the theme style element and injects it as `<style data-theme-style="true">` into its shadow root.
- **Preview Iframe Propagation**: `getIframeThemeStylesheetLink()` emits the inline theme styles directly into sandboxed preview iframe srcdocs (file viewer and HTML pages previews) so custom classes, typography, and dark/light color schemes remain synchronized without network requests.

---

## CSS Custom Properties (Theme Tokens)

ShadowClaw exposes CSS variables across several functional categories:

### 1. Layout & Shell Visibility Overrides

These tokens allow a custom site to selectively hide or reconfigure default built-in chrome without modifying core component templates:

| CSS Custom Property                              | Default        | Purpose / Usage                                                                                                             |
| :----------------------------------------------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `--shadow-claw-sidebar-footer-display`           | `block`        | Set to `none` to hide the default sidebar footer containing the Settings button.                                            |
| `--shadow-claw-sidebar-nav-display`              | `flex`         | Set to `none` to hide the default built-in sidebar navigation menu (`.nav-menu`).                                           |
| `--shadow-claw-header-main-toggle-display`       | `block`        | Set to `none` to hide the top-left main app drawer / hamburger toggle button in the header.                                 |
| `--shadow-claw-page-header-display`              | `flex`         | Set to `none` to hide the `<shadow-claw-page-header>` component entirely.                                                   |
| `--shadow-claw-pages-dropdown-container-display` | `flex`         | Set to `none` to hide the page navigation dropdown / breadcrumb selector.                                                   |
| `--shadow-claw-article-header-margin-bottom`     | `1.5rem`       | Controls the bottom margin beneath markdown article headers.                                                                |
| `--shadow-claw-logo-size`                        | `1.5rem`       | Controls the width and height of the header logo element.                                                                   |
| `--shadow-claw-logo-margin`                      | `0 0 0.375rem` | Controls margin spacing around the header logo.                                                                             |
| `--shadow-claw-pages-viewer-margin`              | `0 auto`       | Outer margin on the `.pages__viewer` content container (falls back to `--shadow-claw-pages-margin`).                        |
| `--shadow-claw-pages-viewer-max-width`           | `none`         | Max-width constraint on the `.pages__viewer` container for centred layouts (falls back to `--shadow-claw-pages-max-width`). |
| `--shadow-claw-pages-viewer-width`               | `100%`         | Explicit width of the `.pages__viewer` container (falls back to `--shadow-claw-pages-width`).                               |

### 2. Design Tokens (Colors, Typography & Radii)

Defined globally in `index.css`:

```css
:root {
  /* Fonts */
  --shadow-claw-font-sans:
    system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --shadow-claw-font-mono: "Fira Code", "Courier New", monospace;

  /* Colors (Light Mode) */
  --shadow-claw-bg-primary: #f8fafc;
  --shadow-claw-bg-secondary: #f1f5f9;
  --shadow-claw-bg-tertiary: #e2e8f0;
  --shadow-claw-border-color: #e2e8f0;
  --shadow-claw-text-primary: #0f172a;
  --shadow-claw-text-secondary: #475569;
  --shadow-claw-text-tertiary: #64748b;
  --shadow-claw-link: #1e40af;
  --shadow-claw-link-hover: #334155;
  --shadow-claw-accent-primary: #334155;
  --shadow-claw-accent-hover: #1e293b;

  /* Border Radii */
  --shadow-claw-radius-s: 0.5rem;
  --shadow-claw-radius-m: 0.75rem;
  --shadow-claw-radius-l: 1.25rem;
  --shadow-claw-radius-pill: 62.5rem;

  /* Transitions */
  --shadow-claw-duration-min: 150ms;
  --shadow-claw-duration-regular: 300ms;
}
```

In dark mode (`html.dark-mode`), variables automatically adapt or can be overridden via `@media (prefers-color-scheme: dark)` or `html.dark-mode` selectors.

---

## Slotted Navigation & Viewport Containment

### Slotted Sidebar Elements

Custom sidebars can be supplied via `pages/main/sidebar.html`, `sidebar.slotHtml`, or declarative `sidebar.sections` in `shadow-claw.config.json`. These render into the light DOM within `<shadow-claw>`:

```html
<div slot="sidebar" class="sidebar-custom-sections">
  <section class="sidebar-section">
    <div class="sidebar-section-header"><span>Projects</span></div>
    <div class="sidebar-item">
      <a href="/project-a" class="sidebar-link">Project A</a>
    </div>
  </section>
</div>
```

### Viewport Scroll Containment

To prevent dual scrollbars when using a custom slotted sidebar alongside scrollable main content, enforce viewport containment on the outer document:

```css
/* Prevent the outer SPA window from producing a secondary scrollbar */
html:has(shadow-claw),
body:has(shadow-claw) {
  height: 100%;
  height: 100dvh;
  overflow: hidden;
}

/* Ensure the slotted sidebar container scrolls independently */
.sidebar-custom-sections {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: calc(100vh - 4rem);
  max-height: calc(100dvh - 4rem);
  overflow-y: auto;
  padding: 0.5rem;
}
```

### Active Link Synchronization

Slotted anchor elements (`.sidebar-link`, `[slot^="sidebar"] a`) automatically synchronize `.active` classes and `aria-current="page"` via `syncSlottedSidebarActiveLinks` on:

- History API events (`pushState`, `replaceState`, `popstate`).
- Modern Navigation API transitions (`navigate`).
- Route changes dispatched by the client-side router (`app-routes.ts`).

On viewports narrower than `896px` (mobile drawer), clicking any slotted link automatically collapses the navigation drawer.

---

## Sandboxed Preview Iframe Theme Sync

When viewing markdown documents or HTML files in the Pages preview or File Viewer, content renders inside a sandboxed iframe. ShadowClaw ensures styling consistency across the iframe boundary via `src/ui/iframe-theme.ts`:

1. **Automatic Stylesheet Inclusion**:
   - `getIframeThemeStylesheetLink(siteConfig)` inspects the active site configuration and injects the configured `theme.stylesheet` into the iframe's `<head>`.
2. **Computed CSS Property Reflection**:
   - `getIframeThemeStyleHtml()` reads all computed `--*` CSS custom properties from `document.documentElement` and mirrors them into the iframe's `:root` style block.
3. **Color Scheme & Class Mirroring**:
   - Both `document.documentElement` (`<html>`) and `document.body` (`<body>`) receive the matching `.dark-mode` or `.light-mode` class across the host application (`src/core/theme-init.ts`, `src/stores/theme.ts`) and within sandboxed preview iframes (`file-viewer-preview-bridge.js`, `build-html-page-srcdoc.ts`).
   - The preview bridge updates `document.documentElement.style.colorScheme` and class lists across both `<html>` and `<body>` upon receiving `shadow-claw-theme-update` messages, ensuring that stylesheets targeting body-scoped selectors (such as `body.dark-mode` or `body.light-mode`) apply cleanly and prevent Flash of Unstyled Content (FOUC).

---

## Shadow DOM Theme Stylesheet Injection

To ensure typography, layout tokens, and custom CSS classes apply seamlessly inside the component shadow root without leaking or causing Flash of Unstyled Content (FOUC):

1. **Declarative Shadow DOM (DSD SSR)**:
   - During SSR pre-rendering (`prerender-dsd-shell.ts` and `prerender-pretty-paths.ts`), if `theme.stylesheet` is configured, `<link rel="stylesheet" data-theme-stylesheet="true" href="...">` is injected directly into `<template shadowrootmode="open">` inside `<shadow-claw-pages>`.
2. **Client-Side Rendering (CSR Hydration)**:
   - When mounting or navigating dynamically on the client, `shadow-claw-pages` calls `ensureThemeStylesheet()`, dynamically verifying and injecting the theme stylesheet `<link>` tag into its shadow root if not already present.

---

## Complete Theming Example

Below is a complete, working `pages/main/theme.css` example implementing custom layout tokens, viewport containment, and slotted sidebar styling:

```css
:root {
  /* Hide unwanted built-in shell elements */
  --shadow-claw-header-main-toggle-display: none;
  --shadow-claw-page-header-display: none;
  --shadow-claw-pages-dropdown-container-display: none;
  --shadow-claw-sidebar-footer-display: none;

  /* Custom Spacing */
  --shadow-claw-article-header-margin-bottom: 1.5rem;
}

/* Contain the outer viewport */
html:has(shadow-claw),
body:has(shadow-claw) {
  height: 100%;
  height: 100dvh;
  overflow: hidden;
}

/* Slotted Sidebar Scroll & Layout */
.sidebar-custom-sections {
  --shadow-claw-radius-m: var(--shadow-claw-radius-s, 0.375rem);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: calc(100vh - 4rem);
  max-height: calc(100dvh - 4rem);
  overflow-y: auto;
  padding: 0.5rem;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-section-header {
  color: var(--shadow-claw-text-secondary, #888);
  font-size: var(--shadow-claw-font-size-sm, 0.875rem);
  font-weight: 500;
  padding: 0.25rem 0.5rem;
}

.sidebar-link {
  color: var(--shadow-claw-text-primary);
  text-decoration: none;
  padding: 0.375rem 0.5rem;
  border-radius: var(--shadow-claw-radius-s, 0.375rem);
  transition: background-color var(--shadow-claw-duration-min) ease;
}

.sidebar-link:hover,
.sidebar-link.active {
  background-color: var(--shadow-claw-bg-secondary);
  color: var(--shadow-claw-link);
}
```
