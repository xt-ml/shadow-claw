#!/usr/bin/env node

import { rm } from "node:fs/promises";
import { argv, exit } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataProjectRoot = join(__dirname, "..");

process.chdir(dataProjectRoot);

const [, script, source] = argv;

export async function rimraf(path) {
  try {
    await rm(path, { recursive: true, force: true });
    console.log(`Successfully deleted: ${path}`);
  } catch (error) {
    console.error(`Error while deleting ${path}:`, error.message);
  }
}

function usage() {
  console.error(`${script} [source]`);
}

if (!source) {
  usage();

  exit(1);
}

await rimraf(source);
