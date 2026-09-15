#!/usr/bin/env node

/**
 * @fileoverview CLI runner for build pipeline, delegating to src/cli/build/build.js.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distTarget = join(__dirname, "../dist/cli/build/build.js");

if (!existsSync(distTarget)) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npmCmd, ["run", "-s", "build:cli"], {
    cwd: join(__dirname, ".."),
    stdio: "inherit",
  });
}

const { runBuild } = await import("../dist/cli/build/build.js");

runBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
