import { readFile, writeFile } from "node:fs/promises";
import path, { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { patchServiceWorkerTrustedTypes } from "../../service-worker/patch-service-worker-trusted-types.js";

const DEFAULT_SERVICE_WORKER_PATH = resolve(
  process.cwd(),
  "dist/public/service-worker.js",
);

export interface PatchServiceWorkerTrustedTypesFileOptions {
  readFileImpl?: (path: string, encoding: "utf8") => Promise<string>;
  writeFileImpl?: (
    path: string,
    data: string,
    encoding: "utf8",
  ) => Promise<any>;
  patchImpl?: (source: string) => string;
  logImpl?: (...args: any[]) => void;
}

export async function patchServiceWorkerTrustedTypesFile(
  targetPath: string = DEFAULT_SERVICE_WORKER_PATH,
  {
    readFileImpl = readFile,
    writeFileImpl = writeFile,
    patchImpl = patchServiceWorkerTrustedTypes,
    logImpl = console.log,
  }: PatchServiceWorkerTrustedTypesFileOptions = {},
): Promise<void> {
  const source = await readFileImpl(targetPath, "utf8");
  const patched = patchImpl(source);

  if (patched !== source) {
    await writeFileImpl(targetPath, patched, "utf8");
    logImpl(`Patched Trusted Types imports in ${targetPath}`);
  }
}

export async function main(): Promise<void> {
  await patchServiceWorkerTrustedTypesFile(
    process.argv[2] || DEFAULT_SERVICE_WORKER_PATH,
  );
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
