# 🦞 [ShadowClaw](https://xt-ml.github.io/shadow-claw/)

[![npm version](https://img.shields.io/npm/v/shadow-claw.svg)](https://www.npmjs.com/package/shadow-claw)
[![Ask DeepWiki](https://img.shields.io/badge/DeepWiki-xt--ml%2Fshadow--claw-blue.svg)](https://deepwiki.com/xt-ml/shadow-claw)

**ShadowClaw** is a multi-runtime AI assistant featuring a rich interactive frontend client, a host-native headless server-side agent participant, and a local control plane that bridges them both.

In the frontend client (browser PWA or native Electron desktop app), the core orchestration state machine, dynamic context windowing, and tool-execution loop run off the main thread in a dedicated Web Worker, with sandboxed local execution via `just-bash` (or optional WebVM Alpine Linux) backed by OPFS and IndexedDB storage, and reactive UI powered by native Web Components and TC39 Signals.

[![ShadowClaw Screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/shadow-claw-screenshot-1024x768.png)](https://xt-ml.github.io/shadow-claw/)

_Watch a demo:_ [Peer-to-peer Browser Native Agents in action (YouTube)](https://www.youtube.com/watch?v=h1les1A3gcg)

On the server side, the headless CLI agent participant (`shadow-claw agent`) runs the same reasoning loop, declarative skills, and tool chain pipeline directly against host Node.js environments—backed by SQLite (`node:sqlite`), native filesystem handles, and host OS shell execution. Inference routes seamlessly across cloud providers, as well as local engines.

![ShadowClaw CLI agent explaining quantum superposition](https://xt-ml.github.io/shadow-claw/assets/screencasts/shadow-claw-cli-agent-explain-quantum-superposition.gif)

_Watch a demo:_ [Running AI Agents Locally: ShadowClaw Setup and Prompt Testing (YouTube)](https://www.youtube.com/watch?v=zVxPGHipdvU)

Tying the two runtimes together is the **server-side control plane** (`shadow-claw server`): a local Express daemon and client bridge that acts as a real-time bidirectional gateway connecting browser/Electron tabs, the CLI, and external AI clients. Connected browser tabs register over SSE, WebSocket, or WebRTC, becoming live execution surfaces with access to in-browser OPFS storage and WebMCP tools. External tools and CLI commands can dispatch prompts (`shadow-claw send`), trigger backups, or query state across any connected tab.

For external AI hosts, ShadowClaw provides multiple ways to interact with the browser agent and server:

- **In-browser WebMCP tools:** Exposed over `document.modelContext`
- **CLI participant:** `shadow-claw agent` is a full-featured CLI agent that can be run from the terminal or CI/CD pipelines.
- **Control Plane API:** `shadow-claw server` exposes a REST API that allows external AI clients to interact with the agent and server.
- **An official MCP server** across two transports:
  - **Streamable HTTP (`POST /mcp`):** Built directly into `shadow-claw server`, allowing HTTP-capable MCP clients to query and drive connected tabs over local network endpoints.
  - **STDIO Bridge (`shadow-claw mcp`):** Connects desktop MCP clients directly over standard input/output. It discovers active browser tabs via the control plane and dynamically relays their in-browser tools (`shadowclaw_client_*` such as OPFS `read_file`, `write_file`, and `bash`), alongside built-in server tools (`shadowclaw_server_*`).

## [See Apps Using ShadowClaw](#apps-using-shadowclaw)

## Quick Start

### 1. Launch Interactive Assistant in Browser or Desktop

```bash
npx shadow-claw dev --open
```

Open Settings, configure your preferred provider (or run with the default Transformers.js or OpenRouter), and start chatting.

### 2. Run Headless Server-Side Agent directly from Terminal

Execute prompts and declarative skills directly against your workspace without opening a browser:

```bash
# Initialize headless workspace with interactive model selection
npx shadow-claw agent init ./my-project

# Manage local models (list, download from Hugging Face with progress bar, set default, migrate to shared cache)
npx shadow-claw agent model list
npx shadow-claw agent model download onnx-community/gemma-4-E2B-it-ONNX
npx shadow-claw agent model set onnx-community/gemma-4-E2B-it-ONNX
npx shadow-claw agent model migrate

# Run one-shot agent prompt with scoped tools (reduces context for compact local models)
npx shadow-claw agent --workspace ./my-project --no-history --tools list_files run "list the files in ."

# Multi-turn prompts retain history by default; clear conversation history anytime
npx shadow-claw agent --workspace ./my-project clear

# Pure text completion without tools or system prompt overhead
npx shadow-claw agent --tools none --no-system-prompt --no-history run "Explain quantum superposition in two sentences"

# Pipe plain text into an agent tool (auto-mapped to tool schema)
echo "how are you doing today" | npx shadow-claw agent tool rewrite_text

# Attach local files (repeatable) — images, PDFs, audio, code, text
npx shadow-claw agent run "Compare these" --no-tools -f a.png -f b.png

# Images > 3 MB fall back to a text reference by default.
# Raise the limit with --max-image-size (in MB) for larger images:
npx shadow-claw agent run "Describe this poster" --no-tools --max-image-size 10 -f big-photo.png

# Combine CLI prompt with piped document content and save to file
cat doc.txt | npx shadow-claw agent run "Summarize this" -o summary.txt

# Inspect available tools and skills
npx shadow-claw agent tools
npx shadow-claw agent skills

# Search and manage skills from the Open Agent Skills (skills.sh / npx skills) ecosystem
npx shadow-claw skills find "react"
npx shadow-claw skills add vercel-labs/agent-skills
npx shadow-claw skills sync

# Generate or update the Agent Skills Discovery index (.well-known/agent-skills/index.json)
npx shadow-claw skills:index

# Discover and import remote skills, declarative tools, and companion scripts (RFC v0.2.0, GitHub shorthand, or local paths)
npx shadow-claw agent import https://xt-ml.github.io/shadow-claw-agent-cli-weather/
npx shadow-claw agent import vercel-labs/agent-skills --skills react-best-practices
```

### 3. Scaffold a Project or Knowledge Hub

Create a custom template with pages and site configuration:

```bash
npx shadow-claw init my-assistant
cd my-assistant
npx shadow-claw dev --open
```

### 4. From Source (Contributing / Development)

```bash
git clone https://github.com/xt-ml/shadow-claw.git
cd shadow-claw
npm install && npm run dev  # Dev server → http://localhost:8888
```

**Desktop App:** `npm run electron` or `npm run electron:build` for a distributable installer.

---

## Table of Contents

- [Core Capabilities](#core-capabilities)
- [Architecture](#architecture)
- [Multi-Conversation Support](#multi-conversation-support)
- [Providers & Models](#providers--models)
- [Agent Tools & WebMCP](#agent-tools--webmcp)
- [Conversations & Messaging Channels](#conversations--messaging-channels)
- [Documentation Index](#documentation-index)
- [Development](#development)
- [CLI Runtime Commands](#cli-runtime-commands)
- [License](#license)

---

## Core Capabilities

- **Client-Side Worker Orchestration:** The frontend agent decision loop, system prompt building, and tool execution run off the main thread in a dedicated Web Worker to keep the UI smooth and responsive.
- **In-Browser Inference by Default:** Uses Transformers.js by default in the browser client (`DEFAULT_PROVIDER = "transformers_js_browser"`) with guided onboarding. Prompt API (`window.LanguageModel`) and integrated polyfills (`prompt-api-polyfill` and `built-in-ai-task-apis-polyfills`) remain fully supported when manually selected.
- **Headless Server-Side Agent Client:** Execute the same tool-use loop, prompt assembly, and declarative skill tool chains directly from the terminal or CI/CD pipelines via `shadow-claw agent` (`init`, `model`, `skills`, `tools`, `tool`, `skill`, `import`, `run`) and `shadow-claw skills` (`list`, `add`, `remove`, `find`, `init`, `sync`, `update`, `check`, `restore`), with Open Agent Skills (`npx skills` / `skills-lock.json`) ecosystem compatibility, native host OS shell access (`node:child_process`), SQLite persistence (`node:sqlite`), real filesystem access (`NodeFsDirectoryHandle`), and in-process offline model execution via Transformers.js ONNX and Llamafile (featuring visual download progress bars and streaming) or cloud providers.
- **Configurable Multi-Model Routing:** Route queries to Cloud providers (OpenRouter, Anthropic, Gemini, OpenAI, AWS Bedrock), local engines (Ollama, Llamafile, Transformers.js with on-demand Hugging Face model downloading and disk caching), or in-browser WebGPU models (LiteRT-LM).
- **Dual-Dispatch Sandboxing & Storage:** Client-side compute via sandboxed JavaScript and `just-bash` (or WebVM Alpine Linux) backed by Origin Private File System (OPFS) and IndexedDB; paired with host-native Node filesystem handles and SQLite database persistence on the server side.
- **PWA & Electron Desktop Parity:** Deployable as a progressive web app with Service Worker and Web Push, or as a native desktop application with full feature parity.
- **Modular Package Library Exports & Standardized Utilities:** Exposes modular ESM exports declared in `package.json` under `.`, `./cli`, `./cli/*`, `./components`, `./components/*`, `./signals`, `./utils`, and `./utils/*`, compiled via Rolldown into `/lib/` and injected into built pages via `<script type="importmap" data-shadow-claw-importmap="local">` (plus iframe `srcdoc` fallbacks) with Node-safe `ShadowClawElement` (`BaseElement`, `defineElement`), lifted UI primitives (`base-styles`, `shadow-claw-resize-handle`, `shadow-claw-status-bar`), and standardized cross-cutting utilities (`base64`, `coerce`, `dedent`, `delay`, `filename`, `is-binary`, `mime`, `normalize-string-list`, `normalize-workspace-path`, `page-swipe-guard`, `parse-boolean-config`, `parse-stored-string-list`, `seo`, `signals`, `tool-adapter-bridge`, `ulid`, `workbench-fullscreen`, `workspace-fs`).
- **Static Publishing, Theming, SEO & Performance:** Publish documentation portals and knowledge hubs with Declarative Shadow DOM (DSD) SSR, root and sub-route pretty paths, resolved `<base href>` propagation across `index.html` and pre-rendered pretty paths (`resolveSiteBasePath`, `patchBaseHref`), configurable sandboxed iframe vs. direct shadow DOM page rendering (`pages.iframe`, frontmatter `iframe: false` / `render: "shadow"`), companion inline module and autoload custom element initialization (`hasInit: true`), root-relative script source normalization (`normalizeCustomElementScriptSrc`), automated Yoast-style SEO metadata synchronization (page titles, descriptions, canonical URLs, and Open Graph/Twitter social cards across pretty paths and root `index.html`), Apple Home Screen Web App standalone meta tags, automated template multi-size icon suite synthesis (`favicon.svg`, multi-resolution `favicon.ico`, `apple-touch-icon.png`, PWA raster PNG suites 48..1024), attribute-order-agnostic DSD shell container replacement, pre-activated page rendering for non-JavaScript environments, syndication feed generation (RSS 2.0, Atom 1.0, and RDF 1.0 feeds with autodiscovery `<link rel="alternate">` tags), in-place DSD HTML hydration eliminating layout shifts (CLS < 0.02) and FOUC transitions, automated build-time image dimension and resource hint injection (`optimizeImgTags`), production Brotli/Gzip asset pre-compression (`.br` and `.gz`), theme stylesheet shadow root injection for DSD and CSR, smooth anchor navigation, offline Service Worker navigation caching with query-parameter matching, custom stylesheets (`theme.stylesheet`), CSS custom property layout/shell tokens, approved custom element script descriptors (`customElements.scripts`) with page-level frontmatter dependency resolution (`dependencies:` / `scripts:`) and automatic content tag scanning, customizable slotted navigation (`sidebar-nav`, `sidebar`, `sidebar-content`, `sidebar-footer`), and declarative sections. See [Theming Subsystem](docs/subsystems/theming.md) and [Pages System](docs/subsystems/pages.md).
- **Control Plane, CLI & Native MCP Server:** Backed by a Node.js service layer and CLI (`shadow-claw`) that provides background cron scheduling, remote backups, direct WebRTC DataChannel connectivity, and a Stateless MCP server featuring both native server management tools and dynamic browser tool relaying to external agent hosts (Claude Desktop, Cursor, Goose).

---

## Architecture

ShadowClaw follows a **dual-runtime agent pattern**, sharing a unified tool-use loop, prompt assembly engine, and skill execution pipeline across both client environments:

```text
┌───────────────────────────────────────────────────────────────────────┐
│                          SHADOWCLAW RUNTIMES                          │
├───────────────────────────────────┬───────────────────────────────────┤
│  1. INTERACTIVE FRONTEND CLIENT   │  2. HEADLESS SERVER-SIDE CLIENT   │
│     (Browser PWA & Electron)      │        (shadow-claw agent)        │
├───────────────────────────────────┼───────────────────────────────────┤
│ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │
│ │        Web Components         │ │ │         CLI Commands          │ │
│ │     (Chat, Files, Tasks)      │ │ │        (init/run/etc)         │ │
│ └───────────────┬───────────────┘ │ └───────────────┬───────────────┘ │
│                 ▼                 │                 ▼                 │
│ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │
│ │  Orchestrator State Machine   │ │ │  Headless Agent Participant   │ │
│ │      (Signal Reactivity)      │ │ │                               │ │
│ └───────────────┬───────────────┘ │ └───────────────┬───────────────┘ │
│                 ▼                 │                 ▼                 │
│ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │
│ │         Agent Worker          │ │ │   Node.js Execution Target    │ │
│ │ (Off-Main-Thread Web Worker)  │ │ │                               │ │
│ └───────────────┬───────────────┘ │ └───────────────┬───────────────┘ │
├─────────────────┴─────────────────┴─────────────────┴─────────────────┤
│                      SHARED AGENTIC CORE & TOOLS                      │
│                  handleInvoke · executeTool · Memory                  │
│                   discoverSkills · executeToolChain                   │
├───────────────────────────────────┬───────────────────────────────────┤
│ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │
│ │    Browser Execution Layer    │ │ │    Host OS Execution Layer    │ │
│ │───────────────────────────────│ │ │───────────────────────────────│ │
│ │ • Storage: OPFS Group         │ │ │ • Storage: SQLite Database    │ │
│ │   Workspaces + IndexedDB      │ │ │   + NodeFsDirectoryHandle     │ │
│ │ • Shell: just-bash POSIX      │ │ │ • Shell: native child_proc    │ │
│ │   Emulator or WebVM           │ │ │   (Host OS processes)         │ │
│ │ • Group ID: br:main           │ │ │ • Group ID: server:main       │ │
│ └───────────────────────────────┘ │ └───────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

**Key design principles:**

- **Shared Core Engine** — Both the browser worker and headless CLI participant execute the exact same tool-use loop, prompt assembly, and declarative skill pipelines (`handleInvoke`, `executeTool`, `executeToolChain`).
- **Storage Dual-Dispatch** — Polymorphic storage routing (`ShadowClawDatabase`): browser runs on `IDBDatabase` + OPFS; headless CLI participant runs on `node:sqlite` (`DatabaseSync`) + `NodeFsDirectoryHandle` on the real host filesystem.
- **Group Separation** — Browser channel uses `br:main` (and `br:<id>`), while headless CLI automation defaults to `server:main`.
- **Worker Isolation on Frontend** — In browser and Electron runtimes, LLM calls, tool execution, and WebVM all run off-main-thread to keep the UI at 60fps.
- **Reactive Signals** — TC39 Signals (via `signal-polyfill`) drive all UI updates.
- **Standardized Shared Utilities** — Centralizes cross-cutting helpers in `src/utils/` (`shadow-claw/utils`) and tool-family helpers in `src/worker/tools/utils/` to eliminate single-function silos and duplicate implementations.

**Full architecture docs:** See [System Overview](docs/architecture/overview.md), [Worker-Isolated Agent Runtime](docs/decisions/worker-isolated-agent-runtime.md), and [Headless CLI Agent Participant](docs/decisions/headless-cli-agent-participant.md).

---

## Multi-Conversation Support

Each conversation has:

- Independent chat history and token-aware context windowing
- Isolated file workspace (`shadowclaw/<groupId>/workspace/` in OPFS, or real filesystem directory in CLI mode)
- Scheduled tasks and cron automations
- Editable `MEMORY.md` (loaded automatically as system context)
- Optional per-conversation tool tagging and declarative tool overrides
- Optional per-conversation pinned provider/model and token budget limits
- Accessible sidebar with drag-and-drop reordering, clone support, and unread indicators

Last-active conversation persists across reloads. On first launch, a default "Main" conversation is auto-created (`br:main` for browser, `server:main` for headless CLI).

**Full guide:** [docs/architecture/orchestrator.md](docs/architecture/orchestrator.md)

---

## Providers & Models

ShadowClaw supports multiple LLM providers with a unified adapter pattern and configurable defaults:

| Category    | Examples                                                               | Notes                                                                                                                                         |
| :---------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloud**   | OpenRouter, OpenAI, Anthropic, Google Gemini, AWS Bedrock, Vertex AI   | Defaults out-of-the-box to OpenRouter (`openrouter/free`); API key required                                                                   |
| **Local**   | Ollama, Llamafile, Agentfile, Mesh LLM, Transformers.js                | Runs on local server or in-process; automatic Hugging Face model downloading & LocalBinaryDriver execution                                    |
| **Browser** | Transformers.js (Browser), Prompt API (`window.LanguageModel`), LiteRT | Defaults out-of-the-box to Transformers.js (`onnx-community/Qwen3-0.6B-ONNX`); in-browser WebGPU inference with transparent CPU/WASM fallback |

**Provider & Model Hierarchy:**

ShadowClaw resolves default LLM providers and models via a strict precedence cascade:

1. **CLI Option:** `--provider <name>` / `--model <model>`
2. **Environment Variable:** `SHADOW_CLAW_PROVIDER` / `SHADOW_CLAW_MODEL` (or provider-specific keys like `OPENROUTER_API_KEY`, `HUGGINGFACE_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`)
3. **Database Configuration:** `CONFIG_KEYS.PROVIDER` / `CONFIG_KEYS.MODEL`
4. **Declarative Workspace Config:** `settings.defaultProvider` and `settings.defaultModel` in `shadow-claw.config.json`
5. **Default Fallback:** Defaults to Transformers.js (`transformers_js_browser` with model `onnx-community/Qwen3-0.6B-ONNX`) in browser contexts (with guided onboarding), and OpenRouter (`openrouter` with model `openrouter/free`) for headless CLI agent execution.

**Provider Highlights:**

- **In-Browser Inference Default:** Defaults to Transformers.js (`transformers_js_browser`) with model `onnx-community/Qwen3-0.6B-ONNX` and guided onboarding, enabling private, local, zero-configuration in-browser execution with WebGPU acceleration and transparent CPU/WASM fallback.
- **OpenRouter Default for Headless CLI:** Headless execution via `shadow-claw agent` defaults out-of-the-box to `openrouter` with `openrouter/free`.
- **Local Models & Hugging Face Hub:** Automatic on-demand downloading from Hugging Face Hub, disk caching under `assets/cache/transformers.js` (and `assets/cache/llamafile` for Llamafile/Agentfile binaries), opt-in **Shared Model Cache** with zero-redownload migration across same-origin `CacheStorage` scopes, cross-domain local shared folders, HTTP mirror endpoints (`/model-cache/status`, `/model-cache/hf/*`), and shared CLI disk cache (`shadow-claw agent model migrate`), interactive paginated and searchable model browsing during `agent init`, and pre-warming endpoints (`POST /transformers-js-proxy/prewarm`). Unified local model tool calling (`parseLocalModelToolCalls`) supports multi-tool calling, Gemma 4 syntax, streaming tool-call suppression, and defensive schema sanitization across in-process Node executors and server proxy routes using OpenAI function schemas formatted directly for tokenizer chat templates. The `LocalBinaryDriver` architecture supports `.llamafile` and `.agentfile` execution with built-in tool schema catalogs and proxy forwarding. See [Local Models Guide](docs/subsystems/local-models.md).
- **Prompt API & Polyfill Fallbacks:** When Prompt API (`prompt_api`) is manually selected in the browser client, uses native `window.LanguageModel` when available, with automatic degradation to local Transformers.js via `prompt-api-polyfill` and `built-in-ai-task-apis-polyfills` when the native Prompt API is unavailable. Local models can also be prepared and downloaded directly from Settings > AI ("Download Local AI Model") with real-time progress to satisfy browser user-activation requirements.
- **Hardware Feature Probing & Fallbacks:** Probes WebGPU adapter capabilities (`shader-f16`), retries during downloads, and dynamically falls back to WebAssembly CPU (`device: "wasm"`, `dtype: "q4"`) if WebGPU initialization fails or software emulation is detected.
- **Streaming & Resilience:** Streaming responses across OpenAI and Anthropic formats; adaptive rate limiting with `retry-after` handling, 30-second auto-closing, ARIA-accessible countdown dialogs for fatal errors and throttling, and base-path-resolved relative links in action dialogs.

**Setup & details:** [docs/guides/adding-a-provider.md](docs/guides/adding-a-provider.md) | [docs/subsystems/providers.md](docs/subsystems/providers.md) | [docs/subsystems/local-models.md](docs/subsystems/local-models.md)

---

## Agent Tools & WebMCP

The agent has access to **50+ tools** including:

| Category        | Tools                                                                                                                                                                                             |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Files**       | `read_file`, `write_file`, `patch_file`, `delete_file`, `move_file`, `copy_file`, `create_directory`, `list_files`, `open_file`, `attach_file_to_chat`, `send_file`, `search_files`, `diff_files` |
| **Shell**       | `bash` (native OS child process in headless CLI; `just-bash` emulator or optional WebVM in browser)                                                                                               |
| **Built-in AI** | `summarize_text`, `write_text`, `rewrite_text`, `proofread_text`, `detect_language`, `translate_text` (defaults to Active Conversation LLM backend with opt-in local browser Task API polyfill)   |
| **Git**         | `git_clone`, `git_init`, `git_add`, `git_unstage`, `git_commit`, `git_push`, `git_pull`, `git_fetch`, `git_merge`, `git_diff`, and more                                                           |
| **Web**         | `fetch_url`, `fetch_file`, `web_search` (DuckDuckGo via configurable CORS search proxy and URL templates)                                                                                         |
| **Compute**     | `javascript` (sandboxed in browser, native Node in headless)                                                                                                                                      |
| **Agents**      | `spawn_subagent` (parallel task delegation), `prompt_peer` (P2P agent prompt dispatch), `list_peers` (P2P peer discovery), `ask_user` (human-in-the-loop pause)                                   |
| **Time**        | `get_current_time` (ISO 8601 or IANA timezone)                                                                                                                                                    |
| **Tasks**       | `create_task`, `list_tasks`, `update_task`, `delete_task`, `enable_task`, `disable_task`, `run_task`                                                                                              |
| **UI**          | `show_toast`, `send_notification`, `clear_chat`                                                                                                                                                   |
| **Context**     | `update_memory` (edits `MEMORY.md`)                                                                                                                                                               |
| **Remote**      | `remote_mcp_list_tools`, `remote_mcp_call_tool` (external MCP servers)                                                                                                                            |
| **Email**       | `manage_email`, `email_read_messages`, `email_send_message`                                                                                                                                       |
| **Rooms**       | `create_room`, `invite_to_room`, `leave_room`, `list_room_members`                                                                                                                                |
| **A2UI**        | `list_components`, `render_component`                                                                                                                                                             |

### Headless Capability Matrix & Tool Execution

Tools negotiate execution capabilities depending on the active environment:

- **Headless-Safe Tools:** Files, git, bash, fetch, tasks, javascript, email, MCP, and time execute natively in both browser Web Workers and headless CLI environments. In headless mode, `bash` executes directly with full host OS command power via `child_process` strictly bound to the active workspace directory, and git operations connect directly over HTTPS bypassing browser CORS proxies.
- **Browser-Only Tools:** Interactive UI, chat, and PeerJS room tools (`ask_user`, `render_component`, `clear_chat`, `create_room`, `open_file`, `show_toast`, etc.) are filtered out of prompt schemas in headless mode so models are never presented with tools they cannot execute, and report clear capability diagnostics if directly invoked via CLI.
- **Direct Tool Inspection & Execution:** Inspect schemas or execute tools directly from the terminal via `npx shadow-claw agent tool <name> [jsonArgs]` and `npx shadow-claw agent tools`.
- **Stdin Piping & Unix Composability:** Pipe JSON or plain text directly into tools (`echo ... | shadow-claw agent tool rewrite_text`) or prompts (`cat doc.txt | shadow-claw agent run "..." -o out.txt`), redirect to files with `-o, --output <file>`, and suppress logs with `-q, --quiet` for clean Unix pipelines.
- **Stateless MCP Host Tools & Sandboxing:** In `shadow-claw mcp` mode, headless tools are exposed to external coding agents (Claude Desktop, Cursor, Goose) under a tri-tier naming hierarchy (`shadowclaw_server_*`, `shadowclaw_local_*`, `shadowclaw_client_*`) with optional unprefixed routing (`--tool-prefix none`). When `--workspace` is omitted, filesystem tools default to an isolated OS sandbox (`<tmpdir>/shadow-claw/workspace`) with strict backwards path traversal containment.

### WebMCP Integration

When running in browsers supporting the Model Context Protocol (or via `@w3c/webmcp-polyfill`), ShadowClaw automatically registers its tool catalog on `document.modelContext` with normalized input and output schemas across Chrome versions, output schema validation, and signal-based abort handling, routing tool execution safely through the Web Worker.

### Declarative Tools, Skills & Remote Importer

- **Declarative Tools & Skills**: Extend assistant capabilities by placing JSON tool definitions in `.agents/tools/*.json` (or backward-compatible `.agents/tools/main/*.json`) and markdown skill descriptors in canonical flat layout `.agents/skills/<name>/SKILL.md` (with legacy `.agents/skills/main/<name>/SKILL.md` supported for backward-compatible reads).
- **Open Agent Skills (`npx skills` / `skills.sh`) Ecosystem**: Search, install, sync, and manage skills from the [skills.sh](https://skills.sh) registry and GitHub repositories via `npx shadow-claw skills <find|add|list|remove|init|sync|update|check|restore>` (or `npx skills add <owner/repo>`) with `skills-lock.json` provenance tracking, symlinked directory traversal, and discovery index generation (`npx shadow-claw skills:index`).
- **Remote Artifact Importer**: Accessible via the "Import" action in Tool Configuration (`<shadow-claw-tools>`) or `npx shadow-claw agent import <source>`. Discovers tools, companion scripts, and multi-file skills over HTTP conforming to the Agent Skills Discovery RFC v0.2.0 (`/.well-known/agent-skills/index.json`), direct `SKILL.md` URLs, GitHub `owner/repo` / `owner/repo@skill` shorthands, and local directories, verifies SHA-256 digests, and persists them directly into the workspace with graceful fallback when `npx` is unavailable.
- **Security Boundaries**: Stored tools and companion scripts execute headless logic immediately. Custom element UI components (e.g. `<block-garden>`, `<x-pwgen>`) and external domain origins are strictly guarded and must be declared in `shadow-claw.config.json` under `customElements` and `security.connectSrc`.

**Full reference:** [docs/subsystems/tools.md](docs/subsystems/tools.md) | [docs/subsystems/skills.md](docs/subsystems/skills.md) | [docs/subsystems/webmcp.md](docs/subsystems/webmcp.md)

---

## Conversations & Messaging Channels

ShadowClaw supports **four messaging channels** by default:

- `br:` — In-browser chat
- `im:` — iMessage bridge
- `peer:` — PeerJS WebRTC (includes direct peer and room file sharing in Files and File Viewer, and Peer Rooms for multi-agent collaboration)
- `tg:` — Telegram Bot API

Each channel creates isolated conversations with their own message history and workspace (`server:main` reserved for server/CLI automation).

**Setup & architecture:** [docs/guides/configuring-messaging-channels.md](docs/guides/configuring-messaging-channels.md) (setup) | [docs/subsystems/channels.md](docs/subsystems/channels.md) (architecture + custom channels)

---

## Documentation Index

Comprehensive architectural specifications, subsystem deep-dives, step-by-step guides, and ADRs live in [`docs/`](docs/README.md):

- **[Architecture](docs/README.md#architecture):** [System Overview](docs/architecture/overview.md) · [Orchestrator & State Machine](docs/architecture/orchestrator.md) · [Worker Protocol](docs/architecture/worker-protocol.md) · [Storage System](docs/architecture/storage.md) · [Context Management](docs/architecture/context-management.md) · [Streaming](docs/architecture/streaming.md)
- **[Subsystems](docs/README.md#subsystems):** [Headless Agent & CLI](docs/subsystems/cli.md) · [Local Models & Hugging Face](docs/subsystems/local-models.md) · [Shell Emulator](docs/subsystems/shell.md) · [WebVM](docs/subsystems/vm.md) · [Git Integration](docs/subsystems/git.md) · [Channels](docs/subsystems/channels.md) · [Tools & Profiles](docs/subsystems/tools.md) · [Providers & Model Registry](docs/subsystems/providers.md) · [Notifications & Scheduling](docs/subsystems/notifications.md) · [Electron Desktop](docs/subsystems/electron.md) · [Reactive UI & Web Components](docs/subsystems/reactive-ui.md) · [Remote MCP](docs/subsystems/remote-mcp.md) · [Stateless MCP Server](docs/subsystems/mcp-server.md) · [WebMCP](docs/subsystems/webmcp.md) · [Crypto & Secrets](docs/subsystems/crypto.md) · [Control Plane](docs/subsystems/control-plane.md) · [Pages System](docs/subsystems/pages.md) · [Theming & Stylesheets](docs/subsystems/theming.md) · [Agent Skills](docs/subsystems/skills.md) · [Security Hardening](docs/subsystems/custom-element-security.md) · [File Backup](docs/subsystems/backup.md) · [Web Share Target](docs/subsystems/share-target.md) · [OpenAPI](docs/subsystems/openapi.md) · [Monaco Code Editor](docs/subsystems/monaco-editor.md)
- **[Guides](docs/README.md#guides):** [Adding a Provider](docs/guides/adding-a-provider.md) · [Adding a Tool](docs/guides/adding-a-tool.md) · [Adding a Shell Command](docs/guides/adding-a-shell-command.md) · [Adding a UI Page](docs/guides/adding-a-page.md) · [Adding a Channel](docs/guides/adding-a-channel.md) · [Protocol-Agnostic Integrations](docs/guides/protocol-agnostic-integrations.md) · [Service Accounts & Credentials](docs/guides/adding-service-accounts.md) · [Configuring Messaging Channels](docs/guides/configuring-messaging-channels.md) · [Server Development Configuration](docs/guides/server-development-configuration.md) · [Publishing to GitHub Pages](docs/guides/publishing-to-github-pages.md)
- **[Decisions](docs/README.md#decisions):** ADRs on [Headless CLI Agent Participant](docs/decisions/headless-cli-agent-participant.md), [Bundled TypeScript Architecture](docs/decisions/bundled-typescript-architecture.md), [Native Web Components and Signals](docs/decisions/native-web-components-and-signals.md), [Worker-Isolated Agent Runtime](docs/decisions/worker-isolated-agent-runtime.md), [IndexedDB and OPFS Storage](docs/decisions/indexeddb-and-opfs-storage.md), and [Peer-to-Peer Protocol (A2A via AGUI)](docs/decisions/peer-protocol-a2a-agui.md)
- **[Agent Conventions](AGENTS.md):** Architectural guardrails and conventions for AI coding agents
- **[E2E Testing Architecture](e2e/README.md):** Playwright fixtures, page objects, and feature-gated testing

---

## Development

```bash
npm run dev                  # Dev server (watch mode on http://localhost:8888)
npm run dev -- --https       # Dev server with opt-in HTTPS (auto-generates self-signed cert)
npm start                    # Express server
npm test                     # Jest (*.test.ts files live next to source)
npm run storybook            # Storybook component workbench (port 6006)
npm run build:storybook      # Build static Storybook documentation to dist/storybook
npm run build:lib            # Build reusable ESM library and TypeScript declarations to dist/lib
npm run build:cli            # Compile CLI commands and utilities to dist/cli via Rolldown
npm run e2e                  # Playwright E2E tests (e2e/*.test.ts)
npm run e2e:install          # Install Playwright browser binaries
npm run tsc                  # Full TypeScript type-check across all workspaces
npm run build                # Bundle application via Rolldown + generate service worker
npm run build:service-worker # Generate the Workbox service worker
npm run build:prod           # Production bundle build
npm run format               # Format all files via Prettier (with caching)
npm run format:changed       # Format only modified and staged files via Prettier
npm run electron             # Launch Electron desktop app
npm run electron:build       # Build Electron distributable
npm run electron:build:win   # Build Electron for Windows
npm run electron:build:mac   # Build Electron for macOS
```

### CLI Runtime Commands

The `shadow-claw` CLI provides runtime driving, server services, and the headless agent participant:

```bash
# Agent Prompts & Pipeline Execution
npx shadow-claw agent run "prompt"                     # Run agent prompt (retains multi-turn history by default)
npx shadow-claw agent run "prompt" --no-history        # Run isolated one-shot prompt without prior history
npx shadow-claw agent run "prompt" --tools none        # Strip all tool schemas for pure text completion (or --no-tools)
npx shadow-claw agent run "prompt" --no-system-prompt  # Strip system prompt for direct text completion
cat doc.txt | npx shadow-claw agent run -o sum.txt     # Pipe document into agent prompt and write to file
npx shadow-claw agent run "Describe" -f a.png -f b.pdf # Attach one or more local files (repeatable)
npx shadow-claw agent clear                            # Reset conversation history for the group (default server:main)

# Model Management & Setup
npx shadow-claw agent init [dir]                       # Initialize workspace with interactive model selection (supports HF browsing, paging, search)
npx shadow-claw agent model list                       # List local cached ONNX and GGUF models
npx shadow-claw agent model download [modelId]         # Download model from Hugging Face with progress bar
npx shadow-claw agent model set [modelId]              # Configure default headless agent model
npx shadow-claw agent model remote --query <search>    # Search Hugging Face onnx-community repository

# Direct Tool & Declarative Skill Execution (No LLM Inference)
npx shadow-claw agent tools                            # List tools with capability matrix
npx shadow-claw agent tool <name> [jsonArgs]           # Inspect tool schema or execute directly
echo "hello" | npx shadow-claw agent tool <name>       # Pipe text directly into tool (schema auto-mapping)
npx shadow-claw agent skill <name>                     # Execute a declarative skill tool chain directly

# Template Iconography & Apple Web Apps
npx shadow-claw icons [dir]                            # Generate template favicon.svg, favicon.ico, apple-touch-icon, and PWA icons
npx shadow-claw icons [dir] --force                    # Regenerate all raster icons from primary SVG/PNG or monogram

# Decentralized Skills & Tools Discovery (RFC v0.2.0)
npx shadow-claw agent import <source> [options]        # Discover and import remote RFC v0.2.0, GitHub shorthand, or local skills/tools
npx shadow-claw skills:index                           # Generate or update .well-known/agent-skills/index.json

# Open Agent Skills Ecosystem (skills.sh)
npx shadow-claw skills find <query>                    # Search skills on the skills.sh registry
npx shadow-claw skills add <owner/repo>                # Install skills from skills.sh or GitHub via npx skills
npx shadow-claw skills list                            # List discovered workspace skills with lockfile provenance
npx shadow-claw skills <remove|init|sync|restore>      # Manage Open Agent Skills and sync to workspace

# Peer Collaboration & WebRTC
npx shadow-claw agent listen                           # Start headless agent WebRTC listener with orchestration loop
npx shadow-claw clients                                # List connected browser/Electron clients
npx shadow-claw send "your prompt" --client <id>       # Send a prompt to a connected client or peer agent (supports -f, --file)
npx shadow-claw send-file <file> --client <peerId>     # Transfer a file to a peer over WebRTC with optional --prompt
npx shadow-claw peer-id                                # Get or generate persistent CLI Peer ID
npx shadow-claw webrtc listen                          # Start headless WebRTC DataChannel daemon

# Services, MCP & Workspace Storage
npx shadow-claw mcp                                    # Run Stateless MCP server (STDIO, isolated tmpdir sandbox)
npx shadow-claw mcp --workspace .                      # Run Stateless MCP server exposing tools for current workspace
npx shadow-claw mcp --tool-prefix none                 # Expose unprefixed tools (read_file, bash) for Cursor/Claude
npx shadow-claw server --tmp                           # Run services with temporary directory cache (/tmp/shadow-claw)
npx shadow-claw server --cache-dir <dir>               # Run services with custom cache directory
npx shadow-claw tasks --client <id>                    # List scheduled tasks on a client
npx shadow-claw backup                                 # Trigger OPFS workspace backup
npx shadow-claw backup list                            # List available backup snapshots
npx shadow-claw backup delete --backup-id <id>         # Delete a backup snapshot
```

When launching `dev`, `run`, `serve`, or `server` without an existing cache, ShadowClaw prompts interactively to select between `.cache`, `tmpdir()`, or a custom path (skip prompting via `--tmp`, `-y`, `--cache-dir <dir>`, or `SHADOWCLAW_CACHE_DIR`).

Commands support `--transport webrtc` for direct peer-to-peer DataChannel execution with connected browser clients. Control plane authentication automatically resolves tokens across flags, environment variables (`SHADOWCLAW_CONTROL_TOKEN`), system temporary directory (`tmpdir()`), parent directories, and SQLite with automatic fallback retry on 401 Unauthorized errors, and supports HTTPS endpoints via `--https` (and `--insecure` for self-signed certs).

**Full CLI reference:** [docs/subsystems/cli.md](docs/subsystems/cli.md)

---

## Apps Using ShadowClaw

### [ShadowClaw Template](https://xt-ml.github.io/shadow-claw-template/)

[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Discovery-8b5cf6?style=flat)](https://xt-ml.github.io/shadow-claw-template/.well-known/agent-skills/index.json)

A ready-to-fork starter template for publishing custom static sites, documentation portals, and personal AI assistants using ShadowClaw as the build and runtime engine, complete with GitHub Actions workflows, declarative site configuration, pretty-path routing, and bundled skills.

[![ShadowClaw Template screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/xt-ml.github.io_shadow-claw-template-1024x768.png)](https://xt-ml.github.io/shadow-claw-template/)

### [ShadowClaw Light Meter](https://xt-ml.github.io/shadow-claw-light-meter/)

[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Discovery-8b5cf6?style=flat)](https://xt-ml.github.io/shadow-claw-light-meter/.well-known/agent-skills/index.json)

A hardware sensory workbench and real-time telemetry engine for TinyDuino, Bluegiga BLE112, and KY-018 photoresistor hardware, featuring interactive `<tinyduino-control-panel>` custom elements, Web Bluetooth GATT streaming, declarative WebMCP tools, and autonomous agent skills.

[![ShadowClaw Light Meter Screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/xt-ml.github.io_shadow-claw-light-meter-1071x768.png)](https://xt-ml.github.io/shadow-claw-light-meter/)

### [Block Garden Knowledge Hub](https://kherrick.github.io/block-garden-knowledge-hub/)

[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Discovery-8b5cf6?style=flat)](https://kherrick.github.io/block-garden-knowledge-hub/.well-known/agent-skills/index.json)

An interactive documentation portal and technical reference guide for Block Garden—a 3D voxel sandbox exploration, procedural world generation, and farming game engine—featuring embedded custom elements, modding APIs, and in-game agent tools.

[![Block Garden Knowledge Hub screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/kherrick.github.io_block-garden-knowledge-hub-1024x768.png)](https://kherrick.github.io/block-garden-knowledge-hub/)

### [pwgen Knowledge Hub](https://kherrick.github.io/pwgen-knowledge-hub/)

[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Discovery-8b5cf6?style=flat)](https://kherrick.github.io/pwgen-knowledge-hub/.well-known/agent-skills/index.json)

An interactive documentation platform and demonstration engine for the classic Unix `pwgen` password generator compiled to WebAssembly, featuring `<x-pwgen>` custom elements, entropy analysis, and declarative password-generation agent tools.

[![pwgen Knowledge Hub screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/kherrick.github.io_pwgen-knowledge-hub-1024x768.png)](https://kherrick.github.io/pwgen-knowledge-hub/)

### [ShadowClaw DAW](https://xt-ml.github.io/shadow-claw-daw/)

[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Discovery-8b5cf6?style=flat)](https://xt-ml.github.io/shadow-claw-daw/.well-known/agent-skills/index.json)

An in-browser digital audio workstation (DAW) template powered by **ShadowClaw**, featuring a Vanilla JS Web Audio API engine, TC39-shaped reactive Signals, Web Components, and autonomous agent skills.

[![ShadowClaw DAW screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/xt-ml.github.io_shadow-claw-daw-1024x768.png)](https://xt-ml.github.io/shadow-claw-daw/)

### [ShadowClaw Draw](https://xt-ml.github.io/shadow-claw-draw/)

[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Discovery-8b5cf6?style=flat)](https://xt-ml.github.io/shadow-claw-draw/.well-known/agent-skills/index.json)

A mobile-first, accessible Vector (SVG), Bitmap (Canvas 2D), and Animation studio built with plain JavaScript and Web Components.

[![ShadowClaw Draw Screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/xt-ml.github.io_shadow-claw-draw-1920x961.png)](https://xt-ml.github.io/shadow-claw-draw/main/animation/#file=7d3pj-s4dijw7--vIDxA8AJMqbmTej01QPftvpkA3ZP0LAiQLweyLe_7bv_1D4dabJdl2dbYkquvg2TmmuWq6BxRFEmRP_1pvmqTzXAwmr_XOovF5P999916vfbWwhvP2t9xSul381W7Rtbd5qLzXmOUyxrphN12Z_FeM9rWyKobrn8cb95rlFCCPyeuuBksgrd5J2iO12-NQbB-a86C9Vsw6g6DRXc8eq8tZssw-VrD_XAUDMP32j9Hi-5iEDbJD8l3j7_Vmszfa4x_KJwFw_CtGQ6C7fy9ZsUfj__3-MuD8Xjy1hgvR4v3Gs340XDcDN9r-M_jH9bb77U_tNz_1P78fwj50yxsLI6_ETT67dl4OWom8W3c_4ut-8_zOWx1B4P93ybfub_ePo3w5HhdxBhwjTS784n70B0NuqPQHSEhf4oyHpJgsZh168tF-Ff3d-Jv10g9bHdH7zU6r5FVMFiG8-QPfD8a5_xHjfTD7T-6Q_w-_Z56TGvzPfWEEOJ76qnvqaejEoslrEYawaDxq0tssztvzMIFnvzl7L1GPenbeY3MwkkYLL5Ep6U7aoat7qiL34qS05qF4S6Mc-Oy022-1wbBNpwB-3ASsfC99h_uRCR5CAeD7mQeut8KBzBcb60JlzPYwXY4bsR_IKqB0S-SqPKmJ-fLTz_-7MsamS9m4374XouyEH16i08tTQswg41g8l6LDuKwuDfGhMfl40nQ6C6wfnjC1khj815TnNZIY_te09bWyGzzXpOM1shs-17jfJ-A79oZmYjC2rSBUQjriyAzMV-DGfklbJN_C4aT78l_h81gkGQJj-8oRS0-Bsagux7sjnKEf6MxC0Z9EsyGSY4OU_Je-wNXQogfPubIvzlHG_ZeU5iCLf5D0xrZ8PeaNMLTNbLl7zUl_H1eJsGicxyCosA47HqbxkkIg7BNxsuFu2DOBOELK758DILbm6Novtd-JdJKIo0mvxFlmceJ4sbjRGrjaaLwj56PwjSBCQj0ODOKM0f_xTc_Y6U5Pnr26KM_rUb-BJgEf7vrnxz9xFXAx1chqZSrMCyuMK4S-ezKStToAVPQaKzNSQDrsF4Pm6Q1Hi_S1uInbf19JTlbj1TBE6GsS7_wBPkFT4kn3CcfP_m-J4kS1JPkF6Ko9hRRQkfftMJ9Up7FT4rhiRPGU_hJWvw97nua_O_FZmY-4oO1BQY2oDqzlfmx29g2Bul9qNGdNQYHlWI-Ep3JHDRon3WOUvqP7uzsxZhZHQpUZ2xnhYjbWdekzN5rjOl93FnHO7VgoDPe2KPj_Vv3XAP4w9cv4ov_8XDNfY7W1-euN3eoQ7AwNHZ6dKh_n4z753JrmLX2548HK_6VO5qNLjx36MdtN_aA3EWHJeejmAnwIej07FNGIXztSey-YSSaxx9yollDAMP2PHjOaFwJRqJkXhTzIdRBr8f0KaPgWnhK8KvPycKHBnQa4kmjEfqq62SxhCYIZWbPGcXhOZF-_OF8NEsfQlhJ2XzKaNLrROrcFnjZhxYsGrPxc0Zx2HadnJOsm99KQBs24_ZxPH9Z1tM-z89C_iR-uni7ljcHlH3_u3C4Q-hAe2ppJX0Lw2_tW6w1dGGzZOsK-hYnR5vft1j3oAdWmxvvyiej5XvUbHfoRzXbUu1ZqeJ201eeb3Jbm_UK-tDjRjxlNEbFAbj7mYxDOx_NpgkD6LZxOucJo9FWepTb66PZwBCWKz56zmiE8Ji6vqZtBzCCJm_e2P-rJBoen6jz0ewEjEHtJjf2nKqoaThV5ELLiWYLE-Cq-ZzRHLUCl6Pp0hCmUMfR9zNGc9xCf6xpGTfHLl3ADHr9aeds3yMUsimaBwG523lwn77H6f3xYKZoPNiengCmYA60vmPHd_MwmJHFrBuM2oOz3ZAv9os9ua-z2yeKJuPuaDF3Hac_Kk2JVOqPklGiWPQ5Lr8YSR8WMG3tji-Mr7PxaEHcM4my4kiOX-N_U0UMj-JI4onL8y4LzmEJbLP4cHMMgwWZjOeL2zqGt18b8SRkdDW4OX03FyLiVkpodW4C0h18D1Ywtfa4g_j3oNnc16U_aCV-4D9cPHhdcNqRUiI0Jb_hZCERkhO1L_EFEcYQKfG_3fQi5UQYdTiZeHpKhIA12LHSx9VrPOuT-SK87clCwVOi01OCtcfdPGQ8xBOS5p0SMYANrJur467jX4JRcxDWg9ltB8-LnRMtKRESz4C2lAhOibaWCOVKfDwDgmgt8Uzkt7FSwBaG7fZxG_vFPeNph_to_vCV_mjk5TpWbCjinvMcNrWC5Z0BNcOnU80OP74qvnSC7oi0l8GseeYkHI9Vk2Mu-FxECE2UxucikiuiqSKKKaLs2VEUPlAYzoFpaIad7ZmEkznerwm7qRrdfoPLfrqmBPeSOzQOjc7HMdHADPiLvsqPg1cSh7TmyjhmG2AWZh3Zzo9DVHM-GE0eUx3MzuY8nNkw4MD8cVK7jh_O_Hc46DaCUe3shaW7-Mw0XNjjtu0fQXdAWmGw6ISz-b5FYF_VV3aYi8yHXbe3CPFdR7n_-8W1bsJw_JfWREp8wCUEJVJqd79RRBp7eL85eeiPoRmBD1IXze5x5yxOCamPm9t9ZPKr-SouRlZskkiauK2T2C3CB_0Me8X4oJ_R3L6A7bu2o0VXRyH8Mh61yShs9G89_tsfqEZnxuDd3-DzYK6IENjuUcKNcv0BSjhXRFFFmJXuO5QwQYkyijDp4_2JK8K0Jsq3hDOB39GWcGmw7SSC4m9pyojQgiiJteDo7GbdxXyKrVGwaXSP78lh0CznpCrFo5PKjHQ3sMNZ4tMz6Q-w1dmO5_zkeEljFp7vlN7pkN15xLPHmHuuT5nnE2PwGTHxXQmTnk-UJEoxYt25lr7nE2ndibRn1yxgdIEE5sN81T5-DPljGPTJcjIJDzoV_IeD1vPeTYircoaRX4gVWB0xMGsEYb4g1hrCqe9KsMoa9x3O8Vm6slgx2WGlywhyDCyA9dwfnAY5GS8bnX2Q-ovSPz4sSDxYal2_jxIuLbGKukB-IwZLrCZaa8KN6xvilapM-lsXrqu6BVaHNpscX1c_b_djj6_ufy5Gd_sI0F1WJrmslI0m1OWFA94Aa8B4M1wet_LLSTddbPLhCN9rf6AtZvjJrMHtXfPokM3xIec2BI0RsCb0m6z-McH12X4V2lWtQMHRnVKcMIFttzKaMC6J8hVhIvewWxJYFzZyLI-HpY1g1sp5MHTP45Y-J9xELZMi3OdEuRLtLmBOBOP4M6GivoJPiaAm_5JuDYH1gIeT3mlUZBEc1KBHh0YJ9_GSliK6IUrqE659j2EZlUQwbLClEUQIdsW6na01beljq8x2xmT2Df8a3rA-sG1X2PoNgsXmKFXuj1S7QFBJ7SXLTCw731pgFHUfm7dBsGIZnf9gMwhJI5jc-qDz9umIzBHw2esPD7w5w2au12kEp-kvfXGjlkRad7FJievMGPMMURJXoilzdiYFw2hPsfVbm3onM4yzg3j_R2E-Hn7h1Y3XHv7pRdATwELoD_rj08Mva3mj4tZVdxZXd3cJaJl5CZyegMEMWAsGE5-fRpC1vvEr_YEd3Tnvur5RCZd6LT2Djbj03SftYQ9OGY6rFo1wqxaVcasdjR99U7nVjgZXR_5C8NGCdJ_cN7lb7Wiop65sJ0c7YG1ocd_PG0OT_-mO2tkDafwj8z6wDtj-pHWUWPdL6WLRLz_rnx86fhaGxmMynBl0jwMEjcdkOEKTHOs-3mhwfC2FTX_r7H0Sg1sZvPsvt9v-SXDJLAHBg5qfqf_-jz-KH77eqdLg3JvwXZyGEomRMelmBHDBLCfCRuNS5WJX2BfQmkSz2vi7v-GCWCIlJ9IqzNV18yxLENBcb1RmHfkpxN7C_Ow8S2cSgAK67h4P5P8-CcNmbuZ-5l-EukPLcfC8zo_z6Nt4QpkZ66ZcOE7pC0yjiWb0fyNMKjfvz10t4eRXwqgh-HjmN8K0IQJH9JwT95TjfD-rzYD1IdgNj8eHv45x20_GPNPJCCPzIVPB-mMwcEHJlAhJ3rgmyhL89CYYYZa8uY-_Eiuse9AxJYKTN3f9EIlf4z5hirwpSt4OxiaLcLM4vGhajdkMZAPEfHV8s_gSTFzUFH7Yj0-O7g8P2HPiux1KgjPPuF1KBldZtcajxVsrGHYH2_faPBjN3-bhrNuKfzDv7sKoj-A-ruN9TJrSGsFg34JRozOevdeGXfdo6s8__Ok7LD-bjzUF2YTePFCZ-WDwtdR8LGbBaN4az4b480WwCP-v8DQRUniGGC498-9RzrAgzhnHm-yds_Y1P2tN2gQZwmq1qWdmjcN_Vp41ToSSLmvKU3HWsCDOmvD43bP2nxeyJucgW2DEupWZNQF_rThrbxQrm_ZdVWNx0rQfp4x59u4p--uFlPkGZBtsfzPPTJmEn6tOmfAsEdZ6lhjO0pqGBVHauP-AmvbzhbQ15yA7sLMfJsyStKnKW7U37lm8P2PamO_JKG2uIE6b8VjpzVp3ALILstsJMtOmK69tuO9NchxmYNZEnDUsSLJWelUbaZA9mA9X2bcCU3KH4jRn0q0KwYszyZcUyaVZdnejOZuC7MPchp3MbFn4R8XZ4p4gUvmuOROeH2cMC9K7gL571v5xIWvrFcgBDHlHZGbNh79U3ZwxbM6MjfsbSXOGBWl_4_7N2V_y0xbyEOQQ_I7OvnkyWnl79iaJ9HEDL3Y4ksqGBWnf9v6V7UKDFgYW5Aj60yXNzhqDv1WdNaxt-GiUE8N50udwBck46gF9jr9dyFtrAnIMk2l7k503Xnlt425rMsPFm0nvVuEKr7i_cf_e7aWqNmiBnIBcNtrZKRPwU-XjKJ8ohZPQ2OFIkoYFcdr0A9L204W0TQOQU6Bds8pOm4QvT9BPUwa3tmNdi_sdriBO2_2T9uVC0jZ9kDPYSt9kJ03Bf1XdrOGYQFPqbqI8uR24grRZu__t4L_y89biO5Bz2Gz9YXbeNPxadd5wCKp5dDuIbwbuY3oTvf-o4NcLWbMByAVQ34bZWTPVZw3nOrS0HnNdtvgadQVJl630rDU7IJcwCqTNzpqFf1Z-PxBEG-aSJjwdJw0L0uHB_dP2zwtp605ArqA5VM3stPmVj6rwcaG2-LAQ7wdJy4YFyf2g_FFVayxBrmHX2Z2ZxC17eIB7nahKahLX3v2H58cdsujBWvJfmeLZB9wrSzxzqSjunTnU7AJ69rvwzjqNCa5rCvrb4w21nx0867T6-Byxs-396-BZZ9ACNgDbCo_vm9WDZ_stACwPCuuMA2BDCIb15UkA1XFnmuJtXmq3doNKoqjJi2FWBzaC_qjfzoqhZOws99hPK9DKBzaGaWPKT469NOoMl_G4yoPRu8qT7IW-UHm2EtgE-GTWOjn4CpgzXyJsRnm0uIfx-JNbmi2UOx02-iSxFOdf3KpP5h98wi1A-Mm4f0v3W7iA8oWcfaPI2UO2uWcgZ-w2iKQgdlZSNELfBpEUxM5Kiob7t0EkBdGzsqKRt0EkBdGzSqK5DJEUxM-qqGlXQCQF8bMqWoFroimGoFXSQl8BkVyBoD0UInkhaJ8dQXsI75dB7LDrgNWC-FlJURh7G7BaED8rKxp-HbBaED0rKQqtbgNWC6JnZUXDrwNWC2JnVZyTK4DVgthZ2ddJPrBaFDmrou26Bli9Ajl7KLD6Qs5eyNlJJC_k7IWcvZCzF3JWEDnrNlvApjCj4fBMwqtFztInavlRtANgM9iM1Do_iuqJM5n3ZKrb6wObw3I8H-THURFxdkDOHcbxTSJnKkXOonf1RMyZ_2LOXszZizm7A3MmPyBn5pg4U_yzAWfcU5Iwwz1qHHPGPW0Jw11DzNFmzOOMMI0LfK3VniXMGM-pB_gzYwnztYccmjAeQxKMe8o6Qcn3tCKc4bqlTwehWeFJSbhmmAaLrIsgXCuP41k3xoUqmPCEIlppTzPCLY3SonGhgSFc-ZiIF5P2YtJeTNrnYNKY2wpIDYbruZs0NmZEMOvp26i07nYGbAHjzejjK4QLUGk9uQa2hDXrHPfInoFKSwZCmuZMUmIMZghsBdQMbcYQ4omhtF7QA7YG3VrsTpNfIZTG3btTBYsWFvp5RlevuQW2gVXdDjNDKBtJO3_op1W_w4BtYbHYNk8PvfRFka6SHy2KPKr2p4nvjYDtwMyn4enRl4-jSV8hh2ZV9IJXJtwnE-Fo7kWvuATIfcKVNDi0iL6Jey6Jcq-HxZWQNvrk_q2QTfOp51_XLvaGc-AU2ks7yht559NovfkWOINus31cn0un0bjHUxwN_x3xaFFpBKS51xwjkeZTV-qQNIn_3v-FPCittxbAOTTUrHsSalVQWhy1o9Jc1IilYec35dJMnBcVZyMi02z0DYemxd9wbBpufovgNO5dXrX_O6XTaEqnRdPU3HWnkE6LZqfxR8K4pwnMNwmdxkVCp1kR0WnCfjI6TeL8sMcu42m4cU04vLEooNZmK5AbGLTbx29CrwpQy95rhqaacPsaE8WJu4158X7Q--8-vuCetE0AcgsqYGe26FUOEglP4uM29Of3u0FdwcN2g17QiNqNNcgdsPqOZ-asemTtDV2ARFkTWcoaK19Za_e6oCiEA56tnjyBsoZ9JqF9V9fS3aCu4IG7QS9Ia-3JDhSDTYP3MtP2DNIaEdbHZo35Hk-cNT9p1krYL3qatFUPFIfxZJPdrFXvrDGHrHGXM71H1niKnpTerHWYBSVgvqLZ12f1yBqaJ5Ir16qxVCXCglT0K10l6tR7oCTM6iYbDqueWcNJLimFQyhkKmBJccBQ3F_AutDt6HT6oBQstj0_M2vVc2tvyIJLTY-hUlfwQKj0ggzQGQ1BaZi1RsvMtD2Bt4a7Y_2jmmb8B9azC9Ia7gJSBnajYT-7e_sE0honEp-xHbVpvk67HBW0aV0agLJg26szYlj10lo0NSFib9Mk0JrYe5sPwJcvQGtdtQPlQ9gLR9lpqx5ac8xabIbxFFo7MMNK76l16wpUALTDst3zJ6DWMGFKReP2dFTgCh44KrhAreHiM1UHM96cadiqp9becH8-0mr6cBDqCh44CL2grXUHPVANoKPdNDtvT6CtOdrP949nPFzBw2Y8Llhr3ZkC1YThcnhmlugJrDXqrDXhals6u-YKHji7dsEN664XoELQ280ZELF6bc09CpI2ukj31JpOYb_Siboe74FqQYuGMjtpz4CtaYetRfNEco-t7eeJ7t_VvYCt9awC1YapHU-eFVvD-Q6dzhSxPbYmHmiWXhhS9ZorUB1YtWT2ux9Kx9YybwiKGBoxkvTfY49NHswVPRqXv8Jj48dP6x7lsV1A2X4XHls_XAIXMFf8eDXbZ_fY-p0tcAmrXTqsLO6x9Ue4VRX6a348bHgCj-3g_ZLCz3n635_2gGvo2GbzJIQqRTZ8diQR9EhecsjzaLD-sg7cwGJhdVYUpZtsuUd_Wo02PnALi-5oe3L0VbyhESvMxzc05laiAQ2A-8DCwWkA5ctsbtkXR4o2ej1j9MmPX8_olopEa44MdgKiVUnR6xmFk9vs_vWMwqSvZ-RE4SzYS2b7VmW2h-zNz3B_-HU6SkGRraQohH-bjlJQZCsrGnGdjlJQYispCq5v01EKSmxlRSOu01EKCmxVnJMrdJSCAlvZ10m-jlJUXqui7bpGR7lCXnuojvKS1z67vPYQUzBDXqO3qa8FBbaSojHqNvW1oMBWUjTa3qa-FpTYyopG3Ka-FpTYKonmsvpaUGSroqZd4aQWFNmqaAUuR1NUZqukhb5Cfb1CZnuo-vqS2V4y20kkL5ntJbO9ZLaXzFZQZhs0QuABzBaqeybhlcpsh6YZDo3Ox9EKgNdhpesiP45qbLa9MCfOzmpiFN0u8AZI2mznR1G9zHZ4Nr5FmU37qcyGD7oSmU28ZLaXzPaS2e4gs3F8s-mRzYaYxbHOhpDFJ_PZqPPXjHCPxS3aKZIwIT3qeDatPW4IE9zzNbFWeLgXXuIGOPTZ8Fk60zhqJVZo5MiY0RH0pnzmcUk49T2bY1A8Kc9mlEfRoJKeMsRiNvCqw3B_I0ZTJOyEsJ7G1wQrz_qEW1xr8JsTTnQEuyHd9_w4235i4lNCbaeH_wnRNjdMcY0_3gQQbZO5vfsX2lY-2iYIxxcnoLHj-47RwEYwA237uEBq2N02wCxhPFwdL5D6n-6oTwbdcyOxO1czS5h2DZQRhMX9CHY4zXV-1eRgK4A3YT7s08xO803Y3FBq4CFM9eJ429ATYHM4gZysK7DsfKuHURgNvAWNVjtrlPrE3NwwoMDb0KQqI_0VcnPSxovsDJHa-W3m7BQThtGsA-_AMPTXmWGUTc7lH_7pRdAeAu_Cbu5nwG2lsXNKuerO4uruLgGfZV4CpyegNwDeg-EmFKcRVEDPKXzdLq5ZdS_TNdp90g6bk77vYZdcRMs5qXanx4--aR1SZ6wbMUvF3M-s-6aU1v0e9dR1-NxwOALeh3As13mTC_n43HAeAh-AmO4GH-8WpeJz2ng2weck_ts9K-FRaYTPIdns8DmrXKnD59wa2v1fyMPnhqsN8CEMx5vTUCvC52wcNeJzzEWN-JzBmBJ8jsd5UXE2InxORN-gEVpnE3xOYNVz-Bz-5W8Un8PuYITPaR7hc9zE-JylCT6nhHtggpMdMT7HVILPGRXjc_Rz4XM4VXMDPqf1v4DP9RYUVBeGw3G2AvMs-ByOoY_wOZrs_a8Cn-ttd6B60N3VszmT6vG5N9yyiNgcbo_lqQiGBekG2fvv_b8ANfWVANWH6W4dZKbtCfw5B6kp5GMPNsi6ggdukL3gz_XrTVADGM932fuKn8KfQwWTYm3bb5B1BQ_cIHvBn-t35qCGsDIBy0xb9f4c7vwX1ka7sRN-zqZ7sR-_PfY0Z_MZqBFMpc62SKvn5xylRt1WbM5T3YqmW7EFfYDNcald285BjaGznmfXtOoBOhRNEoBOevYEoIseiJZb1waKgZqAWXey7wbVA3RvCOigBM1c3yMV6CTeA2JKrXSBblBfgJpCMwy3mWl7AoEON7Iyt-lfpDCYZinbxx7Q87iAJQy6TVAz4PW1yEzaE_hz-PRdGuv6uSzBc1xB4qmVbdANJhLUHHTLt9m93OqFiYigY67XIfcEHUvvoPe_PC-1aqsBqAXo1WKdnbTqCTrpADp9mDRX8MCkXQDohkyBWoIYtbItkycA6NwUn-Cu38HStGFByh2WXteGeg5qBWO22mWnrXqC7g0RV-UmSA2Xe4FuL6ndv497QaAbNlqg1qD47kyz9gQCnZPUjI4ltVSg03tJrXyBbti1oDZAZXeWnbcnEOii98FEYLDZ-3N7MPj-tuYFgW441qC2MJsPsifYnkCgE46f892ASuz5uaSq0bIdteHSgNrBYBCcQfueAZ8zREs_Vlz9hJ_zDxTX-_dxL6RtRDVoCq1FL3tg8AT8HM7iasOPFDXDHzhFdIGeG-kQNINFd3HmVlA9PfeGK-y0tfGMpErsOXswI1k65z1qjEFzaM_CMHsit_qRgcuboSJGXFmiz4mDCfD717eb9bkP72F8qD53nqD7Xehzo1Yd-AjM0D9u_z67PjfqLoGPYdKZyczM3KLPjSY-8Ak0Q3n8oPe59LncJSSjuQU-hZnPWichVKfPqWj5Dm4IjfS23HVIo5UBPoOJanayYijZnss99tMqhMv65sA6g8HJsVchzyVrkA7ludwKNOYU-AI6s4V_EkAl8hwuJYqXIKE9Z9IlSGjP6f0SJOO7kxMtQUJ7TqVLkGJ7Ll6ChPacvnoJ0sue-13acw_RBzLsOXabD1PQoCspGqFv82EKGnQlRcP923yYghZdWdHI23yYghZdJdFc9mEKmnRV1LQrfJiCJl0VrcA10RSz6Sppoa_wYa6w6R7qw7xsus9u0z1EXcyQj9h17m1Bk66kKIy9zb0taNKVFQ2_zr0taNGVFIVWt7m3BS26sqLh17m3BQ26Ks7JFe5tQYOu7Osk370tas9V0XZd495eYc891L192XMve-4kkpc997LnXvbcy54raM-NQw58CZtBX51J-NPYc9LkxdERwFewHqtlfhwV2XMHalt-HP0W8DV062aeH0dF-lxq6B3Wqm_RnjM8tedkKs_plzz3kude8ty_LM9J357Ic-yjPCf1S557yXMvee4lz73kud-LPEclkZQ5d8537pwlgrt2_gp1rhd2wKyg3vSPr45Po85NqAa-gc2IZ2tKN6lzE8OBb6ElPiyXfDJ1TuQ8IMUoAg18B7PNoJExHnpidW7SFCAozKbN3Wn6K1TnjMVFehQZp5hty33T8KRtQDDo9wXPDKNsdS7_8E8vgj4FwaG7ltPTw69CnUveNXyozuW-a3gyXoIQMG3256cRVKPO8fR1w6jOifR1w6jOyf3rhqlb5Bm_bhjVOZW-bjhW5-LXDaM6J69-3TDmZC5BSOhPhovi6txka0EomLRH4493i1LVOUMTc07RSJwTNPXmVKzN7a05m_5WnjM3ZW0QGrZquTkJriJnzqeJMoeROWNuL8ypxJfDPpnT5XRqy6lElpM8cuX8yzfT36cqh72hSJUzNlLl8CmHU-UMT1Q5qSJVztUSp8pRk6hy2kSqHOefTJXjrmd70ZSzbo6mqCc3WnRBC5i1OtnQRtmeHC4nwx2aD9vLekFrGVMDWsJY787sZa0cVHrDLXJC4s3oYC-rK3jgXtYLotI4GIJW0G_RbBDiKaQ4ToTScdoS8gwLHrif9YIUN27PQWvg83n2Fv3qpTgk4oSJNMd0N6sreOBu1gtQ3HjUAG1g2RTZu4Crh-JEBMUd7mQVOF1b0j7W04wttqAtqG6vm5mx6pk4hwzTiM_gKRKXMhD3t5QuNGgTOgHtg_ZXg8yMVU_EvaHYJbl2G81VClBhQWKOlF3NJiYEHUB9talnJu0JhLjIh4uuTLH34ZJrs3QdbtKsg65DpzfO7m88gQ6HhpLU1CWNJkqLK0hvAfdXWi6ABpNeHXQD1mt_-KQ-nHudiDGxOJI0acakDIR-QKN2AYibTOqgm9Cqn2nUngCIkwjEuZSZlIdLu7X3r2aXGrRVH3QIHRuushNWPQ7HIr3eddB40tlwBalzdv_uxgUebsp2oFuwC1X2feAJeLg37qbtuGvVZCp2RTh53Om4f8f2QnWb2hboNrT85hmL8Al8OCedKXbknCn2QOXsgg43DTegOzAezubZOXsCHQ57aojBMVfXxF6HS_JWug03HU9Ad0FS2s7OWvU2HF6aaMFFgOMBDrcHHEvH4abrPugerHd1lZ22J8DhPEs0d11c5ns64eHSLi433v3HBReks5mYgO6DP7eL7LRVD8ThPAd6cL5Lm9gDcSnuXnrS6hr0ADat0M9OWvU83BtOQmrDoms08eFYeoXaB2ChF4S42ZCBHsKO0WwQ_zmEOEW0ewURjkJNIsSZ_Si0_AHVbMlAj2A81tk0belCXIy_7f3UR2u9V-BvHzyvx-NvmQLc7wJ_mw4aIAz4enS8u-2z42_TsQFhoUWDUWZmbsHfpsstCB_4IDxehvcE-FuyJUJTnvdEfrMCEUBr1BMnAVRIv4lIBpdEUYnLiHMimDEGog6ryXidFUHZ8Nv5Iz-pPDPJQDRgOhbVsW_S51HFcdXEVZxUN8qtODO9A9EEvpHDk4Mvn3yTPi5HV1ZFa3yYe5ekNRH55tb64KJs9wmRINw3EX2T43vilVshhKuBbPTJ_RvfWKV86vkv8O1bBd8esuU_gxPi16ErBaG3kqIQ_m3oSkHoraxoxHXoSkHgraQouL4NXSkIvJUVjbgOXSkIu1VxTq5AVwrCbmVfJ_noSlHQrYq26xp05QrQ7aHoygt0--yg20OowgzQjd6GyRaE3UqKxqjbMNmCsFtJ0Wh7GyZbEHgrKxpxGyZbEHirJJrLmGxB6K2KmnYFv1oQequiFbgcTVHwrZIW-gpM9grw7aGY7At8e4FvJ5G8wLcX-PYC317gW0HwbdYPQIRAJzQ4k_BKwbc9MCbOzgZiFCMFogWati-wddVzbzjAOx_HVIFoQ4sFfn4c1XBvh_zeYRzfJPimUvAt2sQekW_-i3x7kW8v8u0O5Js-Bt-o_4F7k58Ne-OekoQZHhltVnCUzJjyPeu0N8McBqdxca-12kPPzXiOO8CfGUuYrz1fECuMx9A244i-Ifnke1oRznDN0qfT3qzwZGS2WUaslJ4ShGvlcTzrxrhQBROeUEQr7WnUoGiUFk255xvClY-J-ATe2yc03j6t6yaU84E0YVxGrpvIPeyX61ae68Z9jRt0qSDcveYRZTd8ATnyFjLLdju_qHCuWyA6sB6Ercwe5k1G2rzRBtGFVZsez1g-gZG2HwixnElKjKE1A9GDoM_DjCHEEwtp8-4IRB_ELFSnya9QSLPSU0RGb5PFpYXU5AUx2IAYQD3s9p_CR8s7-NPqP1EghrBQsn168KUvjHQV_Whh5FHVP039XIAYAd0ocXr0FchovsTVj5RHr7hlPP7ku5WRCr0zaqNPEktxX6pr6BGuST_hiBs_Gfdv6X4Lsdvr2sbVCMQY1msb5o2-8120Be8A7lEa8-O0lu6icY-nMhr-O7LRotJIRzNOfcBt0tSVOiFNUnerSf5CnpK2UC0QU9hMR82TUKtS0uKonZPmokYpDTvAqZVm4ryoOBuRl2ajbzgxLf6GM9Okl6hpbhPvt-mm0dRNi6aquetSoZsWzVDjj4RxTxSYbxI3jYvETbMictNQ3_tUbpomwuGMl-Q0KT0fJ7c8VVhPm3cC0GNgk2n2Rvey9bQzm80EpzF7lQBOWJDuB73_7uML6Ml8GoKeAFNmlJm2p0DWJBFS4pbt_X5QV_Cw_aAXRKJFuAA9hW44mWYmrXpiDTtgsbDGWZawZssX1hYTBnoGoT_M3npcvbCGu0mE9h3jlO4GdQUP3A16QVhb7ELQc1AbxTOz9gTCmusURPSVTIQ1s6evHr5d9CRnS38CegE83GWrdNUba28MiTVPY9JSYs3TqXdSepO2HHRBL6Ex38rMlD0BsoYdCexcCsfrJCZRhCjEml_pKtFy1wS9Ai42QWbanoBZ425ELl1do6l-hQVpr-P--tWFXsfKn4JeQ781z0YQq6fWEAiXKkEo4huoK3ggUXoBBlh1NqA3sPLDbWbWqpfWpHPW-FFNM65X-7CadsFZW-Fmyy3oxSz7An0CZ43jw0fPHLVqWFBdq7baKtA7WNtz-FX11tpbNDmhYsjJT7A1tYecHkAvX8DW1lqDoTDZrc3TYmsy3rZ-0FtzBdX11tbhBAyDjQpodtaegFrDXeRKUVfb0pGBK3jgyOACt7YeWTAcLJucof2q59ZwMhqfiR4MQpXRDxyCXrDW1qsxGAF8LrIHU09grWEvV1N6PNvhCh4223FBWttIBUbCejo-c31WL61RJ60hCnEws-YKHjizdgEN2zTbYBQs7epM2qqX1t4ckSF9dztgqVAn_QOxtHShbjPsg9EwrS-z31_wHNiaJtpQN-khk56uK0hvB_fv6V7g1jZrDsbAZjnMZsOegVvD50jaPWI8MEtdwQPV0gujqq3qgbHQXwc6ezK3-hECPjgwVMZAbnyZuoK0r_toYP4Kku3DA7uSSLZDly36r98FyrYYWxAzCLf14yHYZ0fZFjMOYg6bnZGZmbkFZVusNiAW0GjSD9uoKl89dfiGSZuHmi22TRBLmEy5OQmhQpZNovWLC__ilxyasw-dt9Ys6RbEChRvjrNiKBtmyzv2kyq0FD0Qa-i2m6eoXBXvZ8TK8vH9jLkVaKl9EBtYboPOSQAV8GwKlxgpLd0iJHw9I37SDmTD1zPiAnrhXrqIr2fEk-NH37QOcjO4iiR9PaNbqhm9ntG6d5erF9D2rQJtD9minwG0sdsQlYJQW0nRCH0bolIQaispGu7fhqgUBNvKikbehqgUBNsqieYyolIQbquipl2BqBSE26poBa6JphjgVkkLfQWicgXg9lBE5QW4fXbA7SE0YQYPxK7DYQvCbSVFYextOGxBuK2saPh1OGxBsK2kKLS6DYctCLaVFQ2_DoctCLVVcU6uwGELQm1lXyf5OGxRoK2KtusaHPYKoO2hOOwLaHsBbSeRvIC2F9D2AtpeQFtBoG3ZnYPYgtTb9ZmEVwu0HdBmMm9z-XLQB7GDjvqwj_hZiLbUV8g_G-MBSAp9OW3lR1E90HZ4Nr5FoE37KdDG3WOsCGgTL6DtBbS9gLY7AG1u2dgh0cbwnV3HSJvCPWKfi2lThBnmgDasjtrxa4IwhNesIZz6rgSrrHHf4dwhHqiPMfbp-DW89qQlVlEXyG_EYInVRGtNuHG9Q7xSlXkBay9g7QWsfS5gzRCucVfzbzjIdsAaMkQ3AWsrNgXJIOjNsnuINwFrK1sHySFotI5bwGcA1qT2kgc-IueZIEZRD0EKsCEdZAwCnphYW4UapAQ2GAWn6a-QWDO4iVxqt-Ysssp4nvS16nCQCmaL9eYpkLX8wz-9CPocpIbloL07PfyyFjkqbl11Z3F1d5eAlpmXwOkJGK5BGsC__wzUmhKMKC484TA15NGUU45-ceiuE7Gil86aaCmqjr7pOBak2ByiyyWeOGGi1ZCc4e9xbDuvayUnHZAWVttOL28cnU-trZYrkD40jTrW38um1rTxbEKtSfy3eyzAo9KIWkOk2FFrVrlSR625VO7_Qh61ttqOQAbAp3RxEmpF1JqNo0ZqjbmokVozGFNCrfE4LyrORkStiegbNCLabEKtCVxe66g1_MvfKLWGnaqIWtM8ota4iak1SxNqTQn3bADH9TG1xlRCrRkVU2v0c1FrvryJWnOrsItSa9tFB4wPbMqP3c6no9bYR2qNVUmt7aQGE8But5pnpq16ag235yGsFm0HNXtpbb8d9P673C_ARLuwA6YOtK6XmVmr3lpzaphSx5tBXcEDN4NesNZ20yWYBiwHnWyh7hmsNZw9tW5PY7oV1BU8cCtovrXWpmwDpgmjwazxpNbaG-50F_EO2nQrqDjYQfv4raCnaWvswISwbrSyG7Yn4NacHcaiDds85ZxYumGb-w_AKPJbtjZdCzAtYL3xJjNtT0Cuod8Rk2vM9-wJucbd479yaxuzCkwblmuTrWBVT64hFiMl3hYwa6m4JhLSievSxbU261kwHeDLwSoza9WLa9J5a9LZYWbvrclUi7l_1yNfBmizpQHThf5omG2HVe-t4WwDAmvWsURiL64lN9H7Y0753lqb6xaYHsxnqp_dya1eU3jj7mFiBJYmV6e_B0v5A67OC20a77TA9ME2pmF21p4AXJNu8dBBzhR7ZMbyqbW2kBTMAEQwyb55PgO15nYxCxZzwknWsCCl_UqvaaIxAjOEcLY8c31Wj63hgyOcVrXuVhB3cV1Beiu4fxc331pri6ECM4Lx1h9np616aw27uMrouNex19YOeh1le2ttsWZgxhBsFr3stFXvrTGnrVmXNH-vrdm0g3t_RTLfW2tLtQIzgVWnm-2kP4G39iYct8bcaErsubVEQ6Qlo2Ft2dqBmYJZyOzu7XNga4ZoaeN5IpNga_ag43H_Lu6lvE0nYGZgl_Ps2bVnwNbwYRraavIIDTP0wCy9_0xRPrbWVmwHBhdKt7OF-SfA1vC1GdpaBwvL5H7gCtJpybIF67Zq-mAW0G9_2Cv_VNaaJIaqeA5cJdaaOpgDv39tO2ut_em7-ar95_8P&name=pelican-riding-a-bicycle.svg)

### [ShadowClaw Agent CLI Weather](https://xt-ml.github.io/shadow-claw-agent-cli-weather/)

[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Discovery-8b5cf6?style=flat)](https://xt-ml.github.io/shadow-claw-agent-cli-weather/.well-known/agent-skills/index.json)

A lightweight, headless weather station, forecasting engine, and outdoor operational advisor powered by the ShadowClaw CLI, Open-Meteo, and Unix stream pipelines, featuring well-known agent skills discovery and automated window scanning.

[![ShadowClaw Agent CLI Weather documentation screenshot](https://xt-ml.github.io/shadow-claw/assets/screenshots/xt-ml.github.io_shadow-claw-agent-cli-weather-1024x768.png)](https://xt-ml.github.io/shadow-claw-agent-cli-weather/)

### [News Summary](https://kherrick.github.io/news-summary/)

A localized news aggregation, automatic deduplication, and topic-centric summarization pipeline powered by ShadowClaw. It monitors configured remote feeds, and compiles clean briefings directly into local markdown snapshots and static HTML.

[![News Summary](https://xt-ml.github.io/shadow-claw/assets/screenshots/kherrick.github.io_news-summary-1024x768.png)](https://kherrick.github.io/news-summary/)

---

## License

AGPLv3. Core logic derived from [openbrowserclaw](https://github.com/sachaa/openbrowserclaw) (MIT).
