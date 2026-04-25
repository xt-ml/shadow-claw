# Bundled TypeScript Architecture

**Status:** Active
**Date:** 2026-04-19
**Commit:** `7d0540e` — "Build pipeline overhaul: TypeScript, Rollup, Electron, and E2E improvements"

## Context

ShadowClaw originally shipped as a collection of browser-native ES modules (`.mjs` files) loaded directly by the browser with no build step. This approach allowed for a rapid development loop (edit and refresh).

## Decision

Migrate the entire codebase to **TypeScript (`.ts`)** compiled and bundled with **Rollup**.

### Key choices:

- **TypeScript** — strict type-checking across the board, shared interfaces via `src/types.ts`, typed messages for the worker protocol
- **Rollup** — produces single-file bundles for frontend, worker, service workers, server, and Electron. Handles Node polyfills via `rollup-plugin-polyfill-node` + aliasing
- **Multiple tsconfig files** — distinct TypeScript configurations for each runtime context:
  - `tsconfig.json` — frontend app (browser, DOM)
  - `tsconfig.agent.worker.json` — worker runtime (WebWorker)
  - `tsconfig.service.worker.json` — service workers (ServiceWorker)
  - `tsconfig.server.json` — server (Node.js)
- **Jest custom resolver (`jest-ts-resolver.cjs`)** — maps `.js` imports to `.ts` files in the test environment, so TypeScript's recommended convention of writing `import from "./foo.js"` works without `@ts-ignore`
- **esbuild for TypeScript transpilation** inside Rollup (via `rollup-plugin-esbuild`) — faster than `ts-loader` or `tsc` for bundling
- **Co-located component assets** — HTML templates and CSS stylesheets move into component subdirectories with the TypeScript source, co-located for clarity

## Trade-offs

### Advantages

- Type-safe codebase — TypeScript catches errors at author time
- Single-file bundles per target — fewer HTTP requests, better performance, tree-shaking
- Node polyfills work automatically in Rollup — libraries like isomorphic-git work in the browser without manual shims
- Electron support — CJS bundle for the main process
- Better test isolation — Jest mocks work cleanly with CJS transform

### Disadvantages

- **Build step required** — `npm run build` before running. Dev loop is now: edit → build → refresh.
- **Rollup config complexity** — `rollup.config.mjs` is ~300 lines managing six separate bundles, plugin configuration, and asset copying
- **TypeScript can be strict** — some areas use `as any` to bridge JavaScript interop
- **Large initial migration** — the `.mjs` → `.ts` migration touched every source file

## Alternatives Considered

| Alternative           | Why not chosen                                                               |
| --------------------- | ---------------------------------------------------------------------------- |
| Vite                  | Opinionated defaults not suited to multi-target (worker, SW, Electron) build |
| Webpack               | Higher config complexity than Rollup for this use case                       |
| esbuild directly      | Rollup's plugin ecosystem and tree-shaking superior for libraries            |
| Remain `.mjs` + JSDoc | Does not give true strict type safety; Electron CJS requirement blocks       |
| Deno                  | Would require rewriting all npm package usage                                |

## Impact

- All files renamed from `.mjs` to `.ts`
- All imports use `.js` extension (TypeScript convention, resolved to `.ts` by build and Jest resolver)
- `docs/`, `e2e/`, and all future feature code are written in TypeScript from the start
- The project now has a production-grade build pipeline with type checking, bundling, and E2E testing
