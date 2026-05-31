#!/usr/bin/env node

/// <reference types="node" />

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { patchServiceWorkerTrustedTypes } from "../src/service-worker/patch-service-worker-trusted-types.js";

const DEFAULT_SERVICE_WORKER_PATH = resolve(
  process.cwd(),
  "dist/public/service-worker.js",
);

async function main() {
  const targetPath = process.argv[2] || DEFAULT_SERVICE_WORKER_PATH;
  const source = await readFile(targetPath, "utf8");
  const patched = patchServiceWorkerTrustedTypes(source);

  if (patched !== source) {
    await writeFile(targetPath, patched, "utf8");
    console.log(`Patched Trusted Types imports in ${targetPath}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
