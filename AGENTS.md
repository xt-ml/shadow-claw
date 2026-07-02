# AGENTS.md — ShadowClaw

> Guidance for AI coding agents (Antigravity, Claude, Codex, etc.) working in this repo.
> **Documentation:** For detailed architecture docs, subsystem deep-dives, step-by-step guides, and architecture decision records, see [`docs/`](docs/README.md).

## Project Snapshot

ShadowClaw is a browser-native AI assistant written in **TypeScript** (`.ts`).
The project uses a **Rollup build pipeline** to bundle the application.

**Stack:** HTML + TypeScript / ESM · Web Components · TC39 Signals · IndexedDB · OPFS · Web Workers · Service Worker (Workbox PWA · Web Push) · Express dev server · Electron desktop · AWS Bedrock · Jest + Playwright tests

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

## Conventions & Guardrails

### Test Driven Development

Tests are the source of truth for expected behavior. Before implementing a new feature or fixing a bug, first write a failing test that captures the desired behavior. Then implement the feature or fix the bug until the test passes.

### File Naming

- Source files use `.ts` (TypeScript).
- Tests live **next to** their source file: `src/orchestrator.ts` → `src/orchestrator.test.ts`.
- End-to-end tests live in `e2e/` and use Playwright with fixtures + Page Objects. Extensions are `.ts`.
- Components are in `src/components/shadow-claw-*/shadow-claw-*.ts` (each in its own subdirectory with co-located `.html` and `.css` files).
- `src/theme-init.ts` is a TypeScript bootstrap script compiled by Rollup as a self-contained IIFE (`dist/public/theme-init.js`). It must remain free of module-level side effects that depend on the full app being ready.

### Types & Imports

- Types are declared in `src/types.ts` as explicit TypeScript interfaces and types.
- External libraries are locally bundled using **Rollup** and `npm install`. Node-only packages (Express, Jest, Workbox CLI, Electron) belong in `devDependencies`.

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
- The `ask_user` tool **blocks the worker** until the UI sends back an `ask-user-response` message. Never call it from a scheduled task or subagent context where no human is present to respond — it will deadlock the worker.

### HTML Sanitization & Trusted Types

- **Explicit Pre-Sanitization:** All dynamically rendered HTML, inline SVGs, or iframe `srcdoc` values must be sanitized using DOMPurify (e.g., `sanitizeToTrustedHtml` or `sanitizeSrcdocHtml`) **before** being passed to the Trusted Types policy.
- **Identity Transform Policy:** The primary Trusted Types policy's `createHTML` callback in `src/security/trusted-types.ts` is intentionally implemented as an identity transform `(input) => input`. This prevents double-sanitization and preserves caller-specified custom sanitization options (such as allowing `blob:` URLs for relative workspace media previews) that would otherwise be lost.
- **Default Trusted Types Policy:** Use `ensureDefaultTrustedTypesPolicy()` from `src/security/default-trusted-types-policy.ts` to register the `"default"` Trusted Types policy idempotently. It uses `trustedTypes.getPolicy("default")` before attempting `createPolicy`, so it is safe to call from multiple modules (including after HMR). Use `toDefaultTrustedScriptUrl()` for script URL sinks such as Workbox service worker registration. Both are called as early as possible from `src/theme-init.ts`.
- **Custom Purify Options:** When rendering media resolved relative to the workspace, pass custom DOMPurify configurations extending the standard `ALLOWED_URI_REGEXP` to allow `blob:` URIs safely.

## What to Avoid

- **Do not** add a frontend framework (React, Vue, Svelte, etc.).
- **Do not** call `indexedDB` or `navigator.storage.getDirectory()` directly — use `src/db/db.ts` and `src/storage/storage.ts`.
- **Do not** `postMessage` to the worker with ad-hoc shapes — use the typed protocol in `docs/architecture/worker-protocol.md`.
- **Do not** store API keys in plaintext — always go through `src/crypto.ts`.
- **Do not** import Electron modules from browser-side `.ts` files — Electron is desktop-only.
- **Do not** rely on `navigator.modelContext` alone for WebMCP detection; prefer `document.modelContext` with `navigator.modelContext` fallback for compatibility.
- **Do not** commit `dist-electron/`, `push-subscriptions.db`, or `scheduled-tasks.db` — they are git-ignored.
- **Do not** add new docs pages without updating `docs/README.md` and verifying references in `AGENTS.md`.
- **Do not** allow file-browser copy/move flows to target the same folder or any descendant folder; enforce the guard in both UI and storage paths and cover it with tests. Always specify both `sourceGroupId` and `targetGroupId` when invoking storage moves/copies.
- **Do not** use raw `window.location.href` or traditional link anchors for internal navigation. Always dispatch a `shadow-claw-navigate` custom event (or use the `handleSpecialLinkNavigation` utility) to switch pages, open files, or scroll to anchors seamlessly.
