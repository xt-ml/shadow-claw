#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function parseSemver(v) {
  const clean = String(v || "")
    .trim()
    .replace(/^[v^~]/, "");
  const match = clean.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/,
  );
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    raw: clean,
  };
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return String(a).localeCompare(String(b));

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;

  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) {
    return pa.prerelease.localeCompare(pb.prerelease);
  }
  return 0;
}

async function main() {
  const pkgJsonPath = path.join(rootDir, "package.json");
  const lockJsonPath = path.join(rootDir, "package-lock.json");

  const pkg = JSON.parse(await readFile(pkgJsonPath, "utf8"));
  let lock;
  try {
    lock = JSON.parse(await readFile(lockJsonPath, "utf8"));
  } catch {}

  const pkgName = pkg.name;
  const localPkgVersion = pkg.version;
  const localLockVersion = lock?.version;

  console.log(`Checking version bump for package "${pkgName}"...`);
  console.log(`- Local package.json version     : ${localPkgVersion}`);
  if (localLockVersion) {
    console.log(`- Local package-lock.json version: ${localLockVersion}`);
    if (localPkgVersion !== localLockVersion) {
      console.error(
        `\n[FATAL] Version mismatch: package.json (${localPkgVersion}) does not match package-lock.json (${localLockVersion})!`,
      );
      console.error(
        `Run "npm install" or "npm version" to synchronize package-lock.json.`,
      );
      process.exit(1);
    }
  }

  let publishedVersion = null;
  try {
    const rawOut = execSync(`npm view ${pkgName} version --json`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (rawOut) {
      publishedVersion = JSON.parse(rawOut);
    }
  } catch (err) {
    const errStr = String(err.stderr || err.message || "");
    if (
      errStr.includes("E404") ||
      errStr.includes("404") ||
      errStr.includes("code E404")
    ) {
      console.log(
        `- Package "${pkgName}" not found on npm registry (initial release allowed).`,
      );
      return;
    }
    console.warn(
      `Warning: Could not fetch version from npm view: ${errStr.trim()}`,
    );
  }

  if (publishedVersion) {
    console.log(`- Published npm registry version : ${publishedVersion}`);
    const cmp = compareSemver(localPkgVersion, publishedVersion);
    if (cmp <= 0) {
      console.error(
        `\n[FATAL] Version assertion failed: Local version (${localPkgVersion}) must be greater than published npm version (${publishedVersion}).`,
      );
      console.error(
        `Please bump the version in package.json and package-lock.json (e.g. "npm version patch|minor|major") before publishing.\n`,
      );
      process.exit(1);
    }
    console.log(
      `✓ Version assertion passed: ${localPkgVersion} > ${publishedVersion}`,
    );
  }
}

main().catch((err) => {
  console.error("Version assertion check failed:", err);
  process.exit(1);
});
