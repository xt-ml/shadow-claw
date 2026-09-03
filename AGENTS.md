# AGENTS.md — ShadowClaw

> Guidance for AI coding agents (Antigravity, Claude, Codex, etc.) working in this repo.
> **Documentation:** For detailed architecture docs, subsystem deep-dives, step-by-step guides, and architecture decision records, see [`docs/`](docs/README.md).

## Project Snapshot

ShadowClaw is a browser-native AI assistant written in **TypeScript** (`.ts`) whose core orchestration and tool-use loop run client-side in the browser. It is deployable as a PWA, a native desktop app via Electron, backed by a Node.js server (local proxying, control plane, MCP), and driven via the `shadow-claw` CLI.
The project uses a **Rolldown build pipeline** to bundle the application.

**Stack:** HTML + TypeScript / ESM · Web Components · TC39 Signals · IndexedDB · OPFS · Web Workers · Service Worker (Workbox PWA · Web Push) · Express dev server · Electron desktop · AWS Bedrock · Jest + Playwright tests · Storybook

## Subsystem Documentation

ShadowClaw has been significantly deduplicated. Instead of a massive `AGENTS.md` file, subsystem documentation now lives in `docs/`. **You must read the relevant files before modifying subsystems:**

| Subsystem / Topic             | Relevant Documentation                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Architecture & Data Flow      | [docs/architecture/overview.md](docs/architecture/overview.md)                           |
| Orchestrator & State          | [docs/architecture/orchestrator.md](docs/architecture/orchestrator.md)                   |
| Worker Protocol (LLM / Tools) | [docs/architecture/worker-protocol.md](docs/architecture/worker-protocol.md)             |
| Storage (IndexedDB / OPFS)    | [docs/architecture/storage.md](docs/architecture/storage.md)                             |
| Token / Context Management    | [docs/architecture/context-management.md](docs/architecture/context-management.md)       |
| Streaming (SSE / UI)          | [docs/architecture/streaming.md](docs/architecture/streaming.md)                         |
| Accounts & Credentials        | [docs/subsystems/accounts.md](docs/subsystems/accounts.md)                               |
| Attachment Capabilities       | [docs/subsystems/attachment-capabilities.md](docs/subsystems/attachment-capabilities.md) |
| A2UI Interactive Surfaces     | [docs/subsystems/a2ui.md](docs/subsystems/a2ui.md)                                       |
| AGUI Events & Adapter         | [docs/subsystems/agui.md](docs/subsystems/agui.md)                                       |
| Channels & Multi-Conversation | [docs/subsystems/channels.md](docs/subsystems/channels.md)                               |
| Chat Template Sanitizer       | [docs/subsystems/sanitizer.md](docs/subsystems/sanitizer.md)                             |
| Cryptography & Secrets        | [docs/subsystems/crypto.md](docs/subsystems/crypto.md)                                   |
| Custom Element Security       | [docs/subsystems/custom-element-security.md](docs/subsystems/custom-element-security.md) |
| Electron Desktop App          | [docs/subsystems/electron.md](docs/subsystems/electron.md)                               |
| Email Integration             | [docs/subsystems/email.md](docs/subsystems/email.md)                                     |
| Git Integration               | [docs/subsystems/git.md](docs/subsystems/git.md)                                         |
| Notifications & Tasks         | [docs/subsystems/notifications.md](docs/subsystems/notifications.md)                     |
| Pages System                  | [docs/subsystems/pages.md](docs/subsystems/pages.md)                                     |
| Providers (OpenAI, Anthropic) | [docs/subsystems/providers.md](docs/subsystems/providers.md)                             |
| Remote MCP                    | [docs/subsystems/remote-mcp.md](docs/subsystems/remote-mcp.md)                           |
| Shell Emulator / Bash Tool    | [docs/subsystems/shell.md](docs/subsystems/shell.md)                                     |
| Tools & Execution             | [docs/subsystems/tools.md](docs/subsystems/tools.md)                                     |
| Trusted Types Tinyfill        | [docs/subsystems/trusted-types-tinyfill.md](docs/subsystems/trusted-types-tinyfill.md)   |
| UI & Signals (Web Components) | [docs/subsystems/reactive-ui.md](docs/subsystems/reactive-ui.md)                         |
| WebMCP Integration            | [docs/subsystems/webmcp.md](docs/subsystems/webmcp.md)                                   |
| WebVM (v86 Alpine)            | [docs/subsystems/vm.md](docs/subsystems/vm.md)                                           |
| CLI & Static Site Publishing  | [docs/subsystems/cli.md](docs/subsystems/cli.md)                                         |
| Control Plane & Client Bridge | [docs/subsystems/control-plane.md](docs/subsystems/control-plane.md)                     |
| Stateless MCP Server          | [docs/subsystems/mcp-server.md](docs/subsystems/mcp-server.md)                           |
| File Backup Subsystem         | [docs/subsystems/backup.md](docs/subsystems/backup.md)                                   |
| OpenAPI & Discoverability     | [docs/subsystems/openapi.md](docs/subsystems/openapi.md)                                 |

## Conventions & Guardrails

### Test Driven Development

Tests are the source of truth for expected behavior. Before implementing a new feature or fixing a bug, first write a failing test that captures the desired behavior. Then implement the feature or fix the bug until the test passes.

### File Naming

- Source files use `.ts` (TypeScript).
- Tests live **next to** their source file: `src/core/orchestrator/orchestrator.ts` → `src/core/orchestrator/orchestrator.test.ts`.
- Storybook stories live **next to** their component file: `src/components/shadow-claw-toast/shadow-claw-toast.ts` → `src/components/shadow-claw-toast/shadow-claw-toast.stories.ts`.
- End-to-end tests live in `e2e/` and use Playwright with fixtures + Page Objects. Extensions are `.ts`.
- Components are in `src/components/shadow-claw-*/shadow-claw-*.ts` (each in its own subdirectory with co-located `.html` and `.css` files). Many large components extract their logic into co-located `utils/` subdirectories. Common shared primitives reside in `src/components/common/` and settings panels in `src/components/settings/`.
- `src/core/theme-init.ts` is a TypeScript bootstrap script compiled by Rolldown as a self-contained IIFE (`dist/public/theme-init.js`). It must remain free of module-level side effects that depend on the full app being ready.

### Types & Imports

- Types are declared in feature-local `*types.ts` modules (for example `src/subsystems/worker/types.ts`, `src/subsystems/tools/types.ts`, and `src/subsystems/channels/types.ts`).
- **A2UI types** live in `src/ui/a2ui/types.ts`. Utility functions are individual ESM files under `src/ui/a2ui/utils/`. Registries are under `src/ui/a2ui/registries/`. The old monolithic `src/ui/a2ui.ts` has been removed — do not recreate it.
- **A2UI catalog renderers** live in `src/components/shadow-claw-a2ui/catalog/basic/` (one file per component, co-located tests). Do not add files directly under `catalog/` — always place them inside a named subdirectory (e.g., `basic/`).
- External libraries are locally bundled using **Rolldown** and `npm install`. Node-only packages (Express, Jest, Workbox CLI, Electron) belong in `devDependencies`.
- **Package Library Exports:** ShadowClaw exposes modular ESM exports declared in `package.json` under `.`, `./components`, `./components/*`, `./utils`, and `./utils/*`. Library bundles and TypeScript declaration files (`.d.ts`) are compiled via `npm run build:lib` (`npm run tsc:lib` + `rolldown -c rolldown.lib.config.mjs`) into `dist/lib/`.
- **JSON Imports:** Always use ES import attributes (`with { type: "json" }`), not the deprecated `assert` syntax.

### JS Shell Capabilities & Limitations (Bash tool)

When WebVM is unavailable, the `bash` tool falls back to a lightweight JavaScript shell emulator powered by `just-bash`.

- **Supported:** POSIX shell built-ins (`echo`, `cat`, `ls`, `cd`, `grep`, `sed`, `awk`, `find`, `jq`, etc.), piping (`|`), redirects (`>`, `>>`), variables, and loops.
- **NOT Supported:** `apt`, `npm`, `pip`, `curl`, `wget`, `git` (use `git_*` agent tools instead).
- **Network Access:** External internet connectivity within the shell is dynamic and controlled globally by the **Internet Access** setting (`vm_bash_full_internet_access`). When disabled, routing to public ranges is blocked.

### Git Merge Conflict Resolution

When `git_merge` encounters conflicts, it returns a **structured conflict report** with inline conflict regions.

1. Use `read_file` to see the full file content with conflict markers.
2. Decide the correct resolution.
3. Use `write_file` to overwrite the file with the **complete resolved content** (no conflict markers remaining).
   **Important:** Always use `read_file` + `write_file` for conflict resolution. Do **not** use `bash`, `sed`, or `awk` — these are fragile with conflict markers and waste iterations.

### Task Recursion Guard

To prevent infinite execution loops, the system enforces a strict recursion guard during task execution.

- Tools that manage tasks (`create_task`, `update_task`, `delete_task`, `enable_task`, `disable_task`) and notifications (`send_notification`) are blocked during scheduled task execution.
- The `run_task` tool is explicitly blocked within **any** task execution context (scheduled or manual) to prevent runaway self-triggering loops.
- The `spawn_subagent` tool is explicitly excluded from the subagent's allowed tools to prevent infinite subagent recursion. Furthermore, parallel subagent spawns respect a globally configured limit (`SUBAGENT_MAX_PARALLEL`).
- The `ask_user` tool **blocks the worker** until the UI sends back an `ask-user-response` message. Never call it from a scheduled task or subagent context (including tasks with the subagent flag enabled) where no human is present to respond — it will deadlock the worker.

### Provider Error Dialogs & Auto-Close

- Provider errors (such as `429` rate limiting, unreachable providers, missing or invalid API keys, and local runtime faults) surface help dialogs via `requestDialog` configured with `autoCloseSeconds: 30`.
- Dialogs display a 1-second visual countdown on the confirmation button and an `aria-live="polite"` status region (`role="status"`, `aria-atomic="true"`). Auto-close ensures unattended task executions and automated runs do not deadlock or block indefinitely waiting for manual modal dismissal.

### Subagent Dispatch & Tool Allowlisting

- Route subagent invocation through `dispatchSubagentInvoke` (`src/core/orchestrator/utils/dispatchSubagentInvoke.ts`) so provider-specific browser/runtime handling stays centralized.
- Do not call `executeTool` from provider loops without passing the active enabled tool list (`allowedTools`). Runtime allowlist checks are enforced in `executeTool` and are required even when schemas already constrain generation.
- Conversation-level `pinnedMaxTokens` overrides are optional and must remain model-aware (clamped to provider/model output limits).

### Private Network Access & Loopback Connections

- **Service Worker Loopback Bypass:** The Service Worker fetch proxy (`src/service-worker/fetch-proxy-rules.ts`) unconditionally bypasses all loopback (`localhost`, `127.0.0.1`, `::1`, `[::1]`) and private IP ranges (`10.x`, `172.16-31.x`, `192.168.x`) so browser tabs hosted on static platforms (such as GitHub Pages or Cloudflare Pages) can connect directly to local servers without Service Worker interception.
- **Client `targetAddressSpace` Signaling:** Outgoing client fetch requests targeting local or private network endpoints (`control-plane-client.ts`, `backup-controller.ts`, `push-client.ts`, `task.ts`, and `fetch-proxy.ts`) must supply `targetAddressSpace: 'loopback'` (or `'private'`) for Chromium Private Network Access (PNA) compliance.
- **Server PNA & Cross-Origin Headers:** Server endpoints set `Access-Control-Allow-Private-Network: true` on both preflight (`OPTIONS`) and cross-origin responses, and trust `.github.io` / `.pages.dev` / `allowedOrigins` origins for browser integration.

### HTML Sanitization & Trusted Types

- **Explicit Pre-Sanitization:** All dynamically rendered HTML, inline SVGs, or iframe `srcdoc` values must be sanitized using DOMPurify (e.g., `sanitizeToTrustedHtml` or `sanitizeSrcdocHtml`) **before** being passed to the Trusted Types policy.
- **Identity Transform Policy:** The primary Trusted Types policy's `createHTML` callback in `src/security/trusted-types.ts` is intentionally implemented as an identity transform `(input) => input`. This prevents double-sanitization and preserves caller-specified custom sanitization options (such as allowing `blob:` URLs for relative workspace media previews) that would otherwise be lost.
- **Default Trusted Types Policy:** Use `ensureDefaultTrustedTypesPolicy()` from `src/security/default-trusted-types-policy.ts` to register the `"default"` Trusted Types policy idempotently. It uses `trustedTypes.getPolicy("default")` before attempting `createPolicy`, so it is safe to call from multiple modules (including after HMR). Use `toDefaultTrustedScriptUrl()` for script URL sinks such as Workbox service worker registration. Both are called as early as possible from `src/core/theme-init.ts`.
- **Custom Purify Options:** When rendering media resolved relative to the workspace, pass custom DOMPurify configurations extending the standard `ALLOWED_URI_REGEXP` to allow `blob:` URIs safely.
- **Iframe Embed Allowlists**

Markdown and HTML preview work should preserve the Settings-backed iframe host allowlist in `src/security/iframe-sanitizer.ts`; update the sanitizer tests and docs when adding or changing embed hosts.

### Local Inference & Transformers.js

- **Hardware Acceleration**: Ensure CPU/WASM fallback explicitly uses `q4` to avoid software emulation. Reject WebGPU adapters lacking `shader-f16`.
- **Chat Templates**: Local providers use dynamic Jinja templating (`chat_template.jinja`) fetched with the tokenizer via the Hugging Face API. Do not hardcode chat templates.

### Static Main Site, Routing & Page Suppression

- **Page Seeding & Suppression:** Static main site pages are seeded from the `pages/main/` directory via `seedStaticMainSite` (`src/storage/staticMainSite.ts`). When removing pages from the Pages sidebar, ensure suppression is recorded via `suppressPage` (`src/storage/suppressedPages.ts`) so they are not automatically re-seeded on app launch. Re-adding a page calls `unsuppressPage` to clear suppression.
- **Static Pretty Paths & Routing:** When `pages/routes.json` is present, `bin/prerender-pretty-paths/prerender-pretty-paths.mjs` generates physical `index.html` files with DSD shells for pretty paths and injects the routing manifest into `#shadow-claw-static-routing` and `static-routing.json` (`src/storage/staticRouting.ts`). Keep routing resolution environment-agnostic (Node.js, Electron, GitHub Pages). Pages containing the `--purge-pages` slug are excluded from pre-rendered static site manifests and DSD output to prevent accidental publication. Client-side route matching uses `isPossibleAppRoute` to validate path compatibility (stripping base path, matching valid top-level pages and pretty paths), ensuring same-origin links to non-app routes (like external demo subpaths) fall back gracefully to native browser navigation.
- **Pre-rendered DSD Shell Override:** `OVERRIDE_PRERENDER_SKELETON` (`override_prerender_skeleton`) allows suppressing Declarative Shadow DOM (DSD) shell content on initial load to prevent visual flash before full hydration. Handled during bootstrap in `src/core/theme-init.ts` and `src/components/shadow-claw/shadow-claw.ts`.
- **Markdown Frontmatter Visibility:** Markdown preview surfaces can optionally render YAML frontmatter as visible metadata/details blocks. Keep the four frontmatter toggles (`pages`, `file_viewer`, `chat`, `tasks`) and their config keys in sync with the rendering behavior when touching markdown UX.
- **Page Navigation & Sanitization:** Ensure `title` strings passed to headers (like `shadow-claw-page-header`) are sanitized (HTML stripped/escaped). Keyboard navigation (`ArrowLeft`/`ArrowRight`) and swipe gestures must include strict focus guards to prevent interfering with active inputs or selections.

### Agent Skills & Declarative Tools

- **Agent Skills:** Skills are discovered from `.agents/skills/**/SKILL.md`; preserve required frontmatter validation, duplicate-name diagnostics, the model-invocation opt-out, and the 2,000-directory discovery limit. Update `docs/subsystems/skills.md` when this contract changes.
- **Declarative Skill Tool Chains:** Skills with `user-invocable: true` support `/skill-name` slash-command routing. Skills with `execution.type: "tools"` dispatch directly to `executeToolChain` on the worker thread via `execute-skill-tools` messages, executing deterministic tool pipelines (with `$pipe` output resolution) without scheduling a Task or calling model LLM prompts. Setting `suppressToast: true` or `suppressOutput: true` on the execution block cascades down to all steps in the tool chain. Default bundled skills include `skill-creator` (with example skills like `toast-random-number` provided in starter templates).
- **Declarative Tools:** Definitions are loaded from `.agents/tools/main/**/*.json` and support `bash`, `javascript`, or delegated `tool` executors. Preserve built-in-name protection, active runtime allowlists, diagnostics for invalid definitions, and the eight-level delegation limit. Declarative tools (such as `generate_random_number.json` in starter templates) can be provided by content repositories. Update `docs/subsystems/tools.md` when this contract changes.
- **JS Tool Expression Evaluation:** `executeJavascript` in `src/worker/tools/ui/javascript.ts` automatically evaluates single expressions without an explicit `return` statement by wrapping them in `return (<expression>);` (with fallback to the raw code if syntax errors occur).

### Custom Element Security & Iframe Sandboxing

- **Custom Element Guards:** `installCustomElementsRegistryGuard` and `installCustomElementDomGuard` (`src/security/custom-element-security.ts`) intercept unauthorized custom element registrations and dynamically strip unapproved custom elements from the DOM tree. Only core elements (`shadow-claw` and `shadow-claw-*`) or elements explicitly allowlisted via `shadow-claw.config.json` (or legacy `site-config.json`) or `CONFIG_KEYS.ALLOWED_CUSTOM_ELEMENTS` are permitted.
- **Iframe Sandboxing & CSP:** Sandboxed preview iframes omit `allow-same-origin` by default to enforce opaque-origin (`null`) isolation and eliminate Chrome sandbox escape warnings, using a nonce-gated Content Security Policy with domain restrictions generated via `getIframeCsp(nonce)`. Persistent storage for sandboxed custom elements (`IndexedDB` and `localStorage`) is provided via a transparent `postMessage` storage proxy bridge (`iframe-storage-bridge.js`) handled by `dispatchStorageProxyCommand.ts` and `iframe-storage-proxy.ts`.
- **Iframe Attribute Cleanups:** When rendering preview iframes (such as in `shadow-claw-pages` and `shadow-claw-file-viewer`), rely on `allow="fullscreen"` and omit redundant `allowfullscreen` boolean attributes to avoid browser DevTools precedence warnings.
- **Approved Script Loading:** Dynamic loading of custom element scripts is restricted to safe protocols and validated host patterns using `loadApprovedCustomElementScript`.

### Component Lifecycle & Storybook Workbench

- **Observed Attributes on Custom Elements:** Custom elements extending `ShadowClawElement` that dynamically react to attribute modifications must declare `static observedAttributes` (for example, `ShadowClawEmptyState` observing `["message", "hint", "compact", "warning"]`) so `attributeChangedCallback` triggers component re-rendering.
- **Storybook Workbench:** Storybook (`npm run storybook` on port 6006, `npm run build:storybook` for static output in `dist/storybook`) uses `@storybook/web-components-vite` (v10) with custom HTML/CSS import attribute handling. Add co-located `*.stories.ts` files for UI components. Storybook defaults to dark mode (`.storybook/preview.ts`) and isolates component visual verification from end-to-end integration tests.
- **Toast Inline Mode & Instance API:** `<shadow-claw-toast>` supports an `inline` attribute (`:host([inline])`) for non-fixed rendering inside documentation or story environments, and exposes a `.show(message, options)` instance method alongside `showToast` and `toastStore`.

### Declarative Configuration, Storage Namespacing & Dynamic Navigation

- **Declarative Configuration (`shadow-claw.config.json`):** Template repositories configure metadata, branding, tool defaults (`defaultToolsProfile`, `enabledTools`), custom element allowlists, navigation visibility, and server/cache storage (`cacheDir`, `server.cacheDir`) via `shadow-claw.config.json` (a superset format with backward compatibility for legacy `site-config.json`), which is patched into production artifacts at build time via `bin/site-config/apply.mjs` and seeded into IndexedDB at runtime via `applySiteConfigDefaults()`.
- **Per-Deployment Storage Namespacing:** Use `namespacedStorage` for `localStorage` keys and `getDbName()` / `getOpfsRootName()` for IndexedDB/OPFS namespacing per deployment namespace (`getDeploymentNamespace()`) to prevent state leakage across subpath deployments. Legacy database stores are automatically migrated via `migrateLegacyDatabase.ts`.
- **Dynamic Sidebar Navigation:** Sidebar navigation items (Pages, Chat, Tasks, Files) support runtime toggling and build-time DSD hiding. Ensure navigation fallback logic (`getDefaultSidebarPage`) resolves to the next visible item when active pages are hidden.

### CLI & Dual-Root Build Pipeline

- **Dual-Root Path Resolution:** The build toolchain (`bin/build/build.mjs`) cleanly decouples `toolchainRoot` (the ShadowClaw package/repo root) from `contentRoot` (the consumer template project). In-repo builds (`resolve(contentRoot) === resolve(toolchainRoot)`) preserve the standalone in-tree compilation path. CLI/template consumer builds read pre-bundled web assets from `toolchainRoot/dist/public` and inject `pages/`, `shadow-claw.config.json` (or `site-config.json`), `assets/`, `.agents/`, and pretty routes from `contentRoot`, outputting to `<contentRoot>/dist/public`.
- **CLI Commands (`bin/cli.mjs`):** The `shadow-claw` / `shadowclaw` CLI provides `build`, `dev`, `run`, `serve`, `server` (aliases: `services`, `api`), `init`, `clients`, `send`, `backup`, `tasks`, `webrtc`, and `peer-id` commands. It supports running dev and headless service servers programmatically via `startServer` (`src/server/server.ts`) with custom `--root-path`, `--cache-dir <dir>`, and `--database-dir` arguments.
- **Cache Directory Selection & Storage Paths:** When launching `dev`, `run`, `serve`, or `server` and no existing cache is detected, ShadowClaw displays an upfront skip tip and interactively prompts to select between the current working directory (`.cache`), system temporary storage (`node:os` `tmpdir()`), or a custom directory. Prompting can be skipped via `--tmp`, `-y`, `--cache-dir <dir>`, `SHADOWCLAW_TMP`, or `SHADOWCLAW_CACHE_DIR`. Cancellation via SIGINT / Ctrl+C is caught cleanly without error traces. All server storage paths (SQLite databases under `<cacheDir>/database`, TLS certs under `<cacheDir>/tls`, logs under `<cacheDir>/logs`, backups under `<cacheDir>/backups`, control tokens at `<cacheDir>/control-token.json`, and WebRTC IPC sockets at `<cacheDir>/webrtc-ipc.sock`) resolve under the configured `<cacheDir>`.
- **HTTPS & Control Plane:** Dev/run/serve/server commands accept `--https`, `--cert <path>`, `--key <path>`, and `--ssl-dir <path>` for opt-in HTTPS with auto-generated self-signed certs; control plane commands (`clients`, `send`, `backup`, `tasks`) accept `--https` and `-k, --insecure` to reach an HTTPS control plane server.
- **Naming Conventions:** Refer to the product/brand in prose and documentation as **ShadowClaw**. Use kebab-case **`shadow-claw`** for package name, CLI commands (`npx shadow-claw`), repositories, directory paths, and custom elements.

## What to Avoid

- **Do not** add a frontend framework (React, Vue, Svelte, etc.).
- **Do not** call `indexedDB` or `navigator.storage.getDirectory()` directly — use `src/db/db.ts` and `src/storage/storage.ts`.
- **Do not** `postMessage` to the worker with ad-hoc shapes — use the typed protocol in `docs/architecture/worker-protocol.md`.
- **Do not** store API keys in plaintext — always go through `src/security/crypto.ts`.
- **Do not** import Electron modules from browser-side `.ts` files — Electron is desktop-only.
- **Do not** register or inject unapproved custom elements without configuring them through `shadow-claw.config.json` (or `site-config.json`) or `setAllowedCustomElements`.
- **Do not** rely on `navigator.modelContext` alone for WebMCP detection; prefer `document.modelContext` with `navigator.modelContext` fallback for compatibility. Use `parseWebMcpInputSchema` to normalize schemas across Chrome 154+ (native object) and Chrome < 154 (DOMString JSON) versions, and `getWebMcpTools` for querying registered tools with graceful degradation.
- **Do not** commit `dist-electron/`, `push-subscriptions.db`, `scheduled-tasks.db`, or `clients.db` — they are git-ignored.
- **Do not** add new docs pages without updating `docs/README.md` and verifying references in `AGENTS.md`.
- **Do not** allow file-browser copy/move flows to target the same folder or any descendant folder; enforce the guard in both UI and storage paths and cover it with tests. Always specify both `sourceGroupId` and `targetGroupId` when invoking storage moves/copies.
- **Do not** use raw `window.location.href` or traditional link anchors for internal navigation. Always dispatch a `shadow-claw-navigate` custom event (or use the `handleSpecialLinkNavigation` utility) to switch pages, open files, or scroll to anchors seamlessly.
- **Do not** bypass the proxy SSRF guard by passing `allowPrivate: true` in code — this is only for the `--allow-private-proxy` CLI flag path. Service-worker JSON requests use the `fromServiceWorker` heuristic automatically.
- **Do not** return raw external content from a new tool without first wrapping it with `wrapUntrustedContent` (`src/worker/utils/wrapUntrustedContent.ts`). Any tool that fetches web pages, emails, API responses, or remote MCP results must apply this wrapping so the LLM receives a structural signal that the content is untrusted data, not instructions.
