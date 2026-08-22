#!/usr/bin/env node

/// <reference types="node" />

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { patchServiceWorkerTrustedTypes } from "../src/service-worker/patch-service-worker-trusted-types.js";

const DEFAULT_SERVICE_WORKER_PATH = resolve(
  process.cwd(),
  "dist/public/service-worker.js",
);

export async function patchServiceWorkerTrustedTypesFile(
  targetPath = DEFAULT_SERVICE_WORKER_PATH,
  {
    readFileImpl = readFile,
    writeFileImpl = writeFile,
    patchImpl = patchServiceWorkerTrustedTypes,
    logImpl = console.log,
  } = {},
) {
  const source = await readFileImpl(targetPath, "utf8");
  const patched = patchImpl(source);

  if (patched !== source) {
    await writeFileImpl(targetPath, patched, "utf8");
    logImpl(`Patched Trusted Types imports in ${targetPath}`);
  }
}

export async function main() {
  await patchServiceWorkerTrustedTypesFile(
    process.argv[2] || DEFAULT_SERVICE_WORKER_PATH,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
