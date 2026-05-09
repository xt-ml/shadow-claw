# ShadowClaw Documentation

> Deeper dives into the systems that make ShadowClaw tick — for humans _and_ agents alike.

## What's in here

### Architecture

How the core pieces fit together.

| Document                                                     | What it covers                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [System Overview](architecture/overview.md)                  | High-level architecture, data flow, design philosophy                                 |
| [Orchestrator & State Machine](architecture/orchestrator.md) | Main-thread state machine, message queue, invoke/compact lifecycle, EventBus          |
| [Worker Protocol](architecture/worker-protocol.md)           | Worker ↔ main thread messages, tool-use loop, streaming, cancellation                 |
| [Storage System](architecture/storage.md)                    | OPFS, local folders, write paths, zip export/import, group workspaces, rename support |
| [Context Management](architecture/context-management.md)     | Token estimation, dynamic windowing, output truncation, auto-compaction               |
| [Streaming](architecture/streaming.md)                       | SSE flow, StreamAccumulator, throttling, intermediate responses, proxy passthrough    |

### Subsystems

Detailed docs for each major subsystem.

| Document                                                                | What it covers                                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Shell Emulator](subsystems/shell.md)                                   | JS shell via `just-bash` AST evaluation, OPFS bridge, supported commands                            |
| [WebVM](subsystems/vm.md)                                               | v86 Alpine Linux, boot modes, exclusivity guard, terminal bridge, 9p sync                           |
| [Git Integration](subsystems/git.md)                                    | isomorphic-git, LightningFS ↔ OPFS sync, merge conflicts, credentials                               |
| [Channel System](subsystems/channels.md)                                | Channel registry, browser/Telegram/iMessage channels, router, multi-channel flow                    |
| [Remote MCP](subsystems/remote-mcp.md)                                  | External MCP servers, tool discovery, authentication, JSON-RPC protocol, OAuth reconnection         |
| [Accounts & Credentials](subsystems/accounts.md)                        | Service account management, credential storage, auth bridges                                        |
| [Tools & Profiles](subsystems/tools.md)                                 | Tool definitions, execution dispatch, profiles, adding new tools                                    |
| [Notifications & Scheduling](subsystems/notifications.md)               | Web Push, VAPID, server-side SQLite scheduler, recursion guards                                     |
| [Providers & Rate Limiting](subsystems/providers.md)                    | LLM provider registry, adapter pattern, Transformers.js (local), adaptive rate limiting, Prompt API |
| [Electron Desktop](subsystems/electron.md)                              | Desktop app architecture, in-process server, power management                                       |
| [Reactive UI](subsystems/reactive-ui.md)                                | Signals, `ShadowClawElement`, `reconcileList`, Web Components, stores                               |
| [Model Registry & Capabilities](subsystems/providers.md#model-registry) | Dynamic model metadata fetching and modality capability detection                                   |
| [Attachment Capabilities](subsystems/attachment-capabilities.md)        | MIME-aware attachment handling and native vs fallback delivery                                      |
| [Chat Template Sanitizer](subsystems/sanitizer.md)                      | Strip control tokens and structural markers from local model output                                 |

### Guides

Step-by-step instructions for common dev tasks.

| Document                                                                       | What it covers                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [Adding a Provider](guides/adding-a-provider.md)                               | How to add a new LLM provider end-to-end                      |
| [Adding a Tool](guides/adding-a-tool.md)                                       | How to add a new agent tool                                   |
| [Adding a Shell Command](guides/adding-a-shell-command.md)                     | How to hook into the JS shell emulator                        |
| [Adding a UI Page](guides/adding-a-page.md)                                    | How to add a new Web Component page/section                   |
| [Adding a Channel](guides/adding-a-channel.md)                                 | How to add a new messaging channel                            |
| [Service Accounts & Credentials](guides/adding-service-accounts.md)            | How to manage encrypted credentials for channels and services |
| [Configuring Messaging Channels](guides/configuring-messaging-channels.md)     | User guide for Telegram and iMessage setup                    |
| [Server Development Configuration](guides/server-development-configuration.md) | CLI flags, CORS modes, host binding, port configuration       |

### Decisions

The _why_ behind key choices.

| Document                                                                            | Decision                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| [Bundled TypeScript Architecture](decisions/bundled-typescript-architecture.md)     | Rationale for the transition to Rollup + TypeScript |
| [Native Web Components and Signals](decisions/native-web-components-and-signals.md) | Why native standards for UI and reactivity          |
| [Worker-Isolated Agent Runtime](decisions/worker-isolated-agent-runtime.md)         | Why the agent and VM run in dedicated workers       |
| [IndexedDB and OPFS Storage](decisions/indexeddb-and-opfs-storage.md)               | Why IndexedDB and OPFS for persistent storage       |

---

## How to use these docs

**Building ShadowClaw?** Start with the [System Overview](architecture/overview.md), then dive into whatever subsystem you're touching.

**Changing build/runtime behavior?** Cross-check the architecture docs with root-level [README](../README.md) so scripts, output paths, and runtime topology stay aligned.

**Adding a feature?** Check the [Guides](#guides) section for step-by-step instructions.

**Working on E2E coverage?** Use the test architecture guide in [e2e/README.md](../e2e/README.md) for fixtures, page objects, and interaction patterns.

**Wondering why something is the way it is?** The [Decisions](#decisions) section has you covered.

**AI agents working in this repo** should start with [AGENTS.md](../AGENTS.md) for conventions and guardrails, then come here for the deeper context. AGENTS.md is optimized for agent consumption; these docs are optimized for human understanding (though agents are welcome here too).

## Contributing to docs

- Keep docs accurate — update them when the code changes.
- Architecture docs describe _what is_ and _how it works_.
- Guides describe _how to do things_.
- Decision docs describe _why decisions were made_ and are append-only (supersede, don't edit).
- For UI documentation, keep component organization guidance aligned with `src/components/common/` for shared primitives and `src/components/settings/` for settings feature components.
- Keep references in this index in sync with actual files under `docs/`, plus root-level `README.md` and `e2e/README.md` when behavior changes cross boundaries.
- Use Mermaid diagrams generously — they render on GitHub and in most editors.
