#!/usr/bin/env node

/**
 * @fileoverview CLI runner for version command, delegating to src/cli/tools/version.js.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distTarget = join(__dirname, "../dist/cli/tools/version.js");

if (!existsSync(distTarget)) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npmCmd, ["run", "-s", "build:cli"], {
    cwd: join(__dirname, ".."),
    stdio: "inherit",
  });
}

const { runVersion } = await import("../dist/cli/tools/version.js");

runVersion().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
