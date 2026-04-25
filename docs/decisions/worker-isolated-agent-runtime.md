# Worker-Isolated Agent Runtime

**Status:** Active
**Date:** Early project — established in original architecture

## Context

The core of ShadowClaw is an LLM agent that:

1. Makes HTTP requests to cloud providers
2. Executes arbitrary code (`bash`, `javascript` tools)
3. Reads and writes files via OPFS
4. Optionally runs a full Alpine Linux VM (v86 WebAssembly)

If all of this ran on the main thread, the browser UI would freeze during LLM calls, bash execution, or VM operations. The question was how to isolate the agent runtime.

## Decision

The entire agent runtime runs in a **dedicated Web Worker** (`src/worker/worker.ts`, bundled to `dist/public/agent.worker.js`).

Communication is strictly message-based — the main thread and worker communicate only via `postMessage()` with typed payloads.

### What runs in the worker

- LLM API calls (`fetch()`)
- Tool execution (`executeTool.ts`)
- JS shell emulator (`src/shell/shell.ts`)
- WebVM initialization and operation (`src/vm.ts`)
- Git operations (`src/git/git.ts`)
- SSE stream parsing (`parseSSEStream.ts`, `StreamAccumulator.ts`)

### What runs on the main thread

- Orchestrator state machine (`src/orchestrator.ts`)
- UI reactivity and rendering
- IndexedDB access
- Task scheduling
- Service worker registration

### Worker ownership of the VM

The WebVM (v86) is **worker-owned**. This was an explicit choice:

- The VM is compute-intensive (WASM) — it would block the main thread if run there
- SharedArrayBuffer is unavailable in many contexts (COEP/COOP headers required)
- The worker can serialize VM I/O events and post them to the main thread for the terminal UI

## Trade-offs

### Advantages

- **Non-blocking UI** — the UI never freezes during LLM calls, tool execution, or VM ops
- **Crash isolation** — a fatal error in the agent loop doesn't crash the main thread
- **Security** — the `javascript` tool sandbox (`sandboxedEval.ts`) runs inside the worker, already isolated from the DOM
- **Clean cancellation** — `AbortController` can cancel in-flight requests without affecting the UI

### Disadvantages

- **No shared memory** — worker and main thread can't share JavaScript objects; everything must be serialized via `postMessage`
- **Structured clone limitations** — not all types can be transferred (e.g., OPFS file handles must be re-acquired in the worker)
- **Message protocol overhead** — adding new worker capabilities requires defining new message types in `src/types.ts` and handlers in `src/worker/handleMessage.ts`
- **Debugging complexity** — breakpoints in the worker require separate DevTools targeting

## Alternatives Considered

| Alternative                 | Why not chosen                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Main thread agent           | Blocks UI during all operations; unacceptable UX                                    |
| SharedWorker                | Would enable multi-tab sharing but adds significant coordination complexity         |
| Service Worker              | Service workers are for network proxy/caching; not suitable for compute-heavy agent |
| SharedArrayBuffer + Atomics | Requires COEP/COOP headers; impractical for general serving                         |

## Impact

- All LLM calls, tool execution, and VM ops are in `src/worker/`
- The worker is the **only** non-test runtime importer of `src/vm.ts`
- Terminal UI components talk to the orchestrator's terminal bridge methods — never directly to `vm.ts`
- New agent capabilities go in `src/worker/executeTool.ts` (new tools) or `src/worker/handleMessage.ts` (new message types)
