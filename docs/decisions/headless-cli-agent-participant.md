# Headless CLI Agent Participant

**Status:** Active
**Date:** 2026-09-12

## Context

Originally, ShadowClaw's agent loop (`handleInvoke` → `executeTool`) was architecturally coupled to the browser: it was dispatched from a Web Worker (`worker-isolated-agent-runtime.md`), and every tool handler was written directly against `IDBDatabase`/`IDBTransaction` via the `ShadowClawDatabase` type (`src/db/types.ts`, `src/worker/utils/executeTool.ts`), with file tools writing to OPFS (`indexeddb-and-opfs-storage.md`).

Server-side automation previously existed only as "push-notification-triggered client-side automation": `task-scheduler-server.ts` polled a SQLite-backed `task-schedule-store.ts` on a 60s tick and fired a Web Push to wake a _browser tab_, which then ran the real agent loop. There was no way to run a skill, slash command, or task end-to-end without a live, connected browser/Electron client — `bin/cli.mjs`'s `send`/`tasks` commands and the MCP `client-tool-relay.ts` both required a connected client and errored out otherwise.

We needed a **stateless, headless CLI agent participant** — invoked via `bin/cli.mjs agent` — that can run the _same_ agent loop, tool dispatch, and skill execution code as the browser, without requiring a connected browser tab.

## Decision

Introduce a **headless runtime target** for the agent loop that is a full participant in tool/skill/task execution, subject to capability negotiation:

1. **Dual-Dispatch Storage Backend.** Introduce a `node:sqlite`-backed wrapper (`ShadowClawSqliteDatabase`) behind `src/db/` with dual-dispatch branches across all `src/db/*.ts` operations. `ShadowClawDatabase` is widened to `IDBDatabase | ShadowClawSqliteDatabase | null`. When running in headless mode, `openSqliteDatabase()` creates/opens an SQLite database mirroring the 5 IndexedDB stores (`messages`, `sessions`, `tasks`, `config`, `pendingShares`).
2. **Filesystem Storage Backend.** `NodeFsDirectoryHandle` implements the `FileSystemDirectoryHandle` and `FileSystemFileHandle` subset used across storage modules (`getGroupDir`, `readGroupFile`, `writeGroupFile`, `discoverSkills`, `loadDeclarativeTools`). `setStorageRootFromPath()` allows switching the storage root to a real filesystem directory.
3. **Tool Capability Matrix & Headless Mode Flag.** `src/config/headless.ts` maintains an explicit `isHeadlessMode()` flag. Tools that require a browser execution surface (`ask_user`, `attach_file_to_chat`, `clear_chat`, `list_components`, `open_file`, `render_component`, `send_file`, `show_toast`, `send_notification`, `spawn_subagent`) return a clean, descriptive error message rather than silently failing. Environment-agnostic tools (`bash`, `read_file`, `write_file`, `git_*`, `fetch_*`, `tasks`, `skills`, `javascript`) execute headlessly. `bash` uses native OS `node:child_process` in headless mode for full command-line power.
4. **CLI Integration.** `shadow-claw agent` subcommands (`init`, `skills`, `tools`, `skill`, `run`) provide a unified command-line experience for initializing workspaces, discovering and inspecting declarative skills and tools, running skills directly, and composable Unix pipeline integration via stdin piping and `-o`/`-q` flags.

## Trade-offs

### Advantages

- Enables true server-side, CI, and cron-triggered automation without requiring a live browser tab.
- Single source of truth for tool and skill logic — no divergent duplicate loops between client and server.
- Storage dual-dispatch preserves 100% backward compatibility with existing IndexedDB and OPFS browser functionality.

### Disadvantages

- Browser-only tools (`render_component`, `open_file`, `spawn_subagent`, WebVM) are unavailable in headless mode and return errors.
- Amends the scope of `indexeddb-and-opfs-storage.md` — SQLite is now permitted on the server/CLI side, while the browser app remains browser-native.

## Alternatives Considered

| Alternative                                          | Why not chosen                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Keep relay-only server automation (status quo)       | Requires a live browser tab; cannot run headless CI automation                  |
| Full duplicate Node implementation of the agent loop | High risk of code divergence and maintenance overhead                           |
| `fake-indexeddb` in production Node runtime          | Unsupported runtime shim with lack of performance and native SQLite persistence |

## Impact

- `src/db/types.ts` widens `ShadowClawDatabase` to include `ShadowClawSqliteDatabase`.
- `src/storage/storage.ts` adds `setStorageRootFromPath()`.
- `src/worker/utils/executeTool.ts` adds the `BROWSER_ONLY_TOOLS` capability gate.
- `bin/cli.mjs` provides the `agent` command group.
