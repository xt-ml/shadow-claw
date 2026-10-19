#!/usr/bin/env node
import { execSync } from "node:child_process";

// Supported formatting extensions matching the main prettier glob
const EXT_REGEX = /\.(?:[cm]?[jt]sx?|html|css|json|md)$/i;

try {
  // Get all unstaged + staged modified/added files (excluding deleted files)
  const output = execSync("git diff --name-only --diff-filter=d HEAD", {
    encoding: "utf8",
  });

  const files = output
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && EXT_REGEX.test(f));

  if (files.length === 0) {
    console.log("No changed files to format.");
    process.exit(0);
  }

  console.log(`Formatting ${files.length} changed file(s)...`);
  execSync(`npx prettier --write ${files.map((f) => `"${f}"`).join(" ")}`, {
    stdio: "inherit",
  });
} catch (err) {
  console.error("Failed to format changed files:", err.message);
  process.exit(1);
}
