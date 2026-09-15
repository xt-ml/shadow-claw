#!/usr/bin/env node

/**
 * @fileoverview CLI entrypoint for ShadowClaw, delegating to src/cli/cli.ts.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distTarget = join(__dirname, "../dist/cli/cli.js");

if (!existsSync(distTarget)) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npmCmd, ["run", "-s", "build:cli"], {
    cwd: join(__dirname, ".."),
    stdio: "inherit",
  });
}

const { main } = await import("../dist/cli/cli.js");

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
