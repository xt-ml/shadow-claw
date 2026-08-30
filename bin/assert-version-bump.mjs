#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

export function parseSemver(v) {
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

export function compareSemver(a, b) {
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

export async function assertVersionBump({
  localPkgVersion,
  localLockVersion,
  pkgName,
  publishedVersion,
  silent = false,
}) {
  if (!silent) {
    console.log(`Checking version bump for package "${pkgName}"...`);
    console.log(`- Local package.json version     : ${localPkgVersion}`);
  }

  if (localLockVersion) {
    if (!silent) {
      console.log(`- Local package-lock.json version: ${localLockVersion}`);
    }
    if (localPkgVersion !== localLockVersion) {
      throw new Error(
        `Version mismatch: package.json (${localPkgVersion}) does not match package-lock.json (${localLockVersion})!`,
      );
    }
  }

  if (publishedVersion) {
    if (!silent) {
      console.log(`- Published npm registry version : ${publishedVersion}`);
    }
    const cmp = compareSemver(localPkgVersion, publishedVersion);
    if (cmp <= 0) {
      throw new Error(
        `Version assertion failed: Local version (${localPkgVersion}) must be greater than published npm version (${publishedVersion}). Please bump the version before publishing.`,
      );
    }
    if (!silent) {
      console.log(
        `✓ Version assertion passed: ${localPkgVersion} > ${publishedVersion}`,
      );
    }
  }
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

  await assertVersionBump({
    localPkgVersion,
    localLockVersion,
    pkgName,
    publishedVersion,
  });
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  main().catch((err) => {
    console.error(`\n[FATAL] ${err.message}\n`);
    process.exit(1);
  });
}
