#!/usr/bin/env node

import { rm } from "node:fs/promises";
import { argv, exit } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataProjectRoot = join(__dirname, "..");

/**
 * Recursively deletes a file or directory.
 *
 * @param {string} path
 *
 * @returns {Promise<void>}
 */
export async function rimraf(
  path,
  { rmImpl = rm, logImpl = console.log, errorImpl = console.error } = {},
) {
  try {
    await rmImpl(path, { recursive: true, force: true });

    logImpl(`Successfully deleted: ${path}`);
  } catch (error) {
    errorImpl(`Error while deleting ${path}:`, error.message);
  }
}

function usage(script) {
  console.error(`${script} [source]`);
}

export async function main({ script = argv[1], source = argv[2] } = {}) {
  if (!source) {
    usage(script);

    exit(1);
  }

  process.chdir(dataProjectRoot);
  await rimraf(source);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
