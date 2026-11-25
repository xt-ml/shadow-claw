# Monaco Code Editor (File Viewer)

> Opt-in, lazily loaded Monaco editor integration for viewing and editing text files in `<shadow-claw-file-viewer>`.

---

## Overview

The File Viewer supports an optional Monaco code editor (`CONFIG_KEYS.FILE_VIEWER_MONACO_ENABLED`, **off by default**) toggled from **Settings → Environment → Misc**. When disabled, the File Viewer uses the lightweight `<textarea>` + Highlight.js overlay. When enabled, Monaco loads on demand inside a same-origin `<iframe>` so it never bloats `dist/public/index.js`, avoids Shadow DOM event-retargeting and stylesheet encapsulation quirks, and falls back to the basic textarea if loading fails.

## Architecture & Lazy Loading

- **Zero main-bundle impact:** `src/monaco-lazy-import-guard.test.ts` enforces that no module under `src/` outside `src/components/shadow-claw-file-viewer/monaco/host/` imports `monaco-editor`.
- **Separate Rolldown entries:** `configs/rolldown/rolldown.config.mjs` builds `monaco-host.ts` and its workers (`editor`, `json`, `css`, `html`) into `dist/public/assets/monaco/`, copying `monaco-host.html`, `monaco-host.css`, and `node_modules/monaco-editor/min/vs/editor/editor.main.css`.
- **Same-origin iframe + `MessageChannel`:** `MonacoEditorController` (`monaco/monaco-editor-controller.ts`) creates `<iframe class="file-monaco-frame" sandbox="allow-scripts allow-same-origin">` pointing to `resolveRuntimeAsset("/assets/monaco/monaco-host.html")` and transfers a `MessagePort` after `load`. File content is passed strictly as text to `monaco.editor.createModel`, never as HTML.
- **Service Worker caching:** `src/service-worker/workbox-config.cjs` excludes `assets/monaco/**` from `globPatterns` precaching and caches it runtime `CacheFirst` under `shadow-claw-monaco-cache`.
- **Trusted Types & CSP:** `src/security/csp.ts` includes `shadowclaw-monaco` in the `trusted-types` directive (Chromium only). `monaco-host.ts` routes all Monaco Trusted Types policy creation through `MonacoEnvironment.createTrustedTypesPolicy` using `shadowclaw-monaco`.

## Language Support & Extensibility

- **Full language-service workers:** `json` (`json.worker.js`), `css` / `scss` / `less` (`css.worker.js`), and `html` (`html.worker.js`).
- **Lazy Monarch tokenizers:** `xml` (including `.svg`), `markdown` (preloading embedded fenced-block languages), `mermaid` (`.mmd`, `.mermaid` via `host/languages/mermaid.ts`), plus common code/config languages (`javascript`, `typescript`, `python`, `ruby`, `rust`, `shell`, `yaml`, `sql`, `java`, `php`, `go`, `dockerfile`).
- **Adding new languages or features:**
  1. Add the extension/filename mapping in `monaco/utils/monaco-language.ts`.
  2. Register a lazy `LanguageSupport` entry in `monaco/host/builtin-languages.ts` (`registry.register({ id, dependencies, load })`).
  3. If the language has a dedicated worker, add its worker entry in `monaco/host/workers/`, register it in `configs/rolldown/rolldown.config.mjs`, and map its label in `monaco/utils/monaco-worker-labels.ts`.

## Mobile-First, Accessibility & Theming

- **Mobile-first (`monaco-options.ts`):** Viewports `<= 640px` or `pointer: coarse` disable the minimap, enable word wrap, use `fontSize >= 14`, disable folding/glyph margin, and size `.file-editor-container--monaco` with `min-block-size: 50dvh`.
- **Accessibility:** The iframe has a descriptive `title`, `.file-editor-status` (`role="status" aria-live="polite"`) announces loading/ready/fallback states, `Escape` (when no Monaco popup widget is open) closes the viewer, `Ctrl/Cmd+S` saves, `Ctrl+M` (`Ctrl+Shift+M` on macOS) toggles Tab-focus mode, and cancelling edit mode returns focus to `.modal-edit-btn`.
- **Themes:** `monaco-theme.ts` maps `--shadow-claw-bg-primary`, `--shadow-claw-text-primary`, and `--shadow-claw-accent-primary` to custom `shadow-claw-dark` / `shadow-claw-light` themes and switches to `hc-black` / `hc-light` when `forced-colors: active` matches.

## Known Limitations

- Monaco's touch/virtual-keyboard IME ergonomics (particularly on iOS Safari) can be less predictable than a native `<textarea>`; the textarea remains the default and automatic fallback.
- TypeScript/JavaScript IntelliSense (`ts.worker`) is omitted from v1 to avoid shipping several extra megabytes of compiler assets; TS/JS files still receive Monarch syntax highlighting.
