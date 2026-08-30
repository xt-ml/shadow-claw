# IndexedDB and OPFS Storage

**Status:** Active
**Date:** Early project — established in original architecture

## Context

ShadowClaw is browser-native. It needs to persist:

1. **Message history** — structured data: role, content, timestamps, groupId
2. **Configuration** — API keys, provider selection, model, settings
3. **Scheduled tasks** — cron expressions, prompts, enabled state
4. **Session data** — LLM conversation history for compaction
5. **Files** — arbitrary files created by the agent or user

The browser has several storage APIs: `localStorage`, `sessionStorage`, `IndexedDB`, `Cache API`, `OPFS`, and the File System Access API.

## Decision

Use **IndexedDB** for structured data and **OPFS** (+ File System Access API) for files.

### IndexedDB for structured data

All DB access goes through `src/db/db.ts`. Never call `indexedDB` directly elsewhere.

**Why IndexedDB:**

- Structured data with proper querying (get by groupId, by timestamp)
- Unlimited storage (no 5MB cap like localStorage)
- Supports indices for efficient queries
- Stores any JavaScript-serializable value (including blobs)
- `CryptoKey` objects can be stored natively for the crypto layer

**`src/db/` module structure:**

The DB layer is broken into small, focused modules (one function per file):

```text
src/db/
├── db.ts              openDatabase(), getDb() singleton
├── openDatabase.ts    Schema migrations
├── saveMessage.ts     Insert/update message
├── getRecentMessages.ts  Paginated message fetch
├── groups.ts          Conversation group CRUD
├── setConfig.ts       Persist config value
├── getConfig.ts       Read config value
├── saveTask.ts        Persist scheduled task
├── getAllTasks.ts      List all tasks
... (one module per operation)
```

This granularity enables:

- Fine-grained unit testing (mock only what's needed)
- Dead code elimination by Rolldown
- Clear ownership of each DB operation

### OPFS for files

Agent-created files and the group workspace live in OPFS (Origin Private File System):

```text
OPFS root /
└── shadowclaw/
    └── <groupId>/
        └── workspace/
            ├── MEMORY.md
            └── user-created-files/
```

**Why OPFS:**

- Persistent, quota-managed storage not subject to browser eviction
- Supports `createSyncAccessHandle()` for synchronous reads in workers (required by isomorphic-git)
- Not accessible to other origins — origin-isolated
- Much faster than IndexedDB for large binary files

### File System Access API (optional)

Users can optionally configure a local directory as the workspace root via `showDirectoryPicker()`. This writes directly to their machine's filesystem — useful for developers who want their workspace files accessible outside the browser.

When a local directory is selected:

- It's stored as a `FileSystemDirectoryHandle` in IndexedDB
- OPFS is bypassed entirely for that group's workspace
- The write path (`writeFileHandle.ts`) works identically regardless of backend

## Trade-offs

### IndexedDB advantages

- Well-supported, reliable
- Good query performance for structured data
- Handles encrypted `CryptoKey` objects natively

### IndexedDB disadvantages

- Async API requires careful `await` chains
- No SQL — relational patterns (joins, aggregates) are awkward
- `fake-indexeddb` is required in Jest tests (browser API, not available in Node)

### OPFS advantages

- Fast, quota-managed file storage
- Worker sync handles for reliable reads
- Compatible with isomorphic-git's synchronous FS requirement

### OPFS disadvantages

- Not accessible from the main thread synchronously (Safari limitation)
- `createWritable()` not available in all contexts — requires fallback to worker bridge (`writeOpfsPathViaWorker`)
- Handles are not structured-cloneable — can't pass between main thread and worker directly

## Alternatives Considered

| Alternative          | Why not chosen                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| `localStorage`       | 5MB limit, synchronous (blocks UI), no structured queries               |
| Cache API            | Designed for network response caching, not app data                     |
| SQLite (WebAssembly) | Adds significant bundle weight; IndexedDB sufficient for the use case   |
| Server-side DB       | Would make ShadowClaw server-dependent; breaks browser-native principle |

## Impact

- All structured data goes through `src/db/`
- All file I/O goes through `src/storage/`
- The two never mix — DB for structured data, storage for files
- `openDatabase()` must be called once at startup (done in `src/core/orchestrator/orchestrator.ts`)
- No direct `indexedDB` or OPFS calls outside their respective layers

## Per-Deployment Storage Namespacing & Migration

To prevent storage state leakage when multiple instances are deployed under subpaths of a single domain (e.g. GitHub Pages project sites like `username.github.io/shadow-claw-deploy-1`), ShadowClaw dynamically namespaces IndexedDB and `localStorage` storage keys.

1. **Namespace Resolution (`getDeploymentNamespace()`):**
   Derived automatically from subpath routing (`getAppBasePath()`) or explicit overrides (`window.__SHADOWCLAW_DEPLOY_ID__` / `process.env.SHADOWCLAW_DEPLOY_ID`).
2. **IndexedDB Scope (`getDbName()`):**
   Computes database names as `shadowclaw-${namespace}` (falling back to legacy `"shadowclaw"` when unnamespaced).
3. **Automated Legacy Migration (`migrateLegacyDatabase.ts` & `migrateLegacyOpfs.ts`):**
   When booting a namespaced deployment for the first time, ShadowClaw checks if data was previously stored under `"shadowclaw"`.
   - **IndexedDB**: Copies all object stores into the new namespaced database in a single non-destructive pass, setting `DB_MIGRATED_FROM_LEGACY`.
   - **OPFS**: Recursively copies all legacy workspace directories and files from `"shadowclaw"` into `"shadowclaw-${namespace}"` (with Safari worker write fallback), setting `OPFS_MIGRATED_FROM_LEGACY`.
   The legacy storage is left intact as a fallback seed.
4. **Namespaced `localStorage` (`namespacedStorage.ts`):**
   Key pattern `shadowclaw:${namespace}:${key}` with automatic one-time copy-on-read from legacy unprefixed keys.
5. **Isolation Assurance:**
   - **Electron Desktop**: Uses a dedicated Chromium profile and user data directory (`~/.config/shadowclaw`), guaranteeing storage isolation regardless of origin.
   - **Local Development**: Runs on distinct origins (`http://localhost:8888`), which browsers partition natively.
