#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

export const DISALLOWED_KEYWORDS = new Set([
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
  "from-git",
]);

export const USAGE_NOTICE = `
Usage: npm run version [<newversion>]

Note: Only explicit semantic version strings (e.g. 1.28.0) are supported.
Keyword commands (major, minor, patch, premajor, preminor, prepatch, prerelease, from-git) are not supported.

Standard npm version syntax for reference:
  npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git]
`.trim();

export async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export function parseSemverString(v) {
  const clean = String(v || "")
    .trim()
    .replace(/^v/, "");
  const match = clean.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/,
  );
  if (!match) return null;
  return clean;
}

export function validateVersionArg(arg) {
  if (!arg) return null;
  const lower = arg.toLowerCase().trim();
  if (lower === "--help" || lower === "-h") {
    return { isHelp: true };
  }
  if (DISALLOWED_KEYWORDS.has(lower)) {
    return {
      error: `Error: Keyword command "${arg}" is not supported by npm run version.\n\n${USAGE_NOTICE}`,
    };
  }
  const clean = parseSemverString(arg);
  if (!clean) {
    return {
      error: `Error: Invalid version string "${arg}". Expected a valid semantic version (e.g. 1.28.0).\n\n${USAGE_NOTICE}`,
    };
  }
  return { version: clean };
}

export async function getVersionMap(targetRoot = rootDir) {
  const pkg = JSON.parse(
    await readFile(path.join(targetRoot, "package.json"), "utf8"),
  );
  let npmVer = "";
  try {
    npmVer = execSync("npm -v", { encoding: "utf8" }).trim();
  } catch {}

  return {
    [pkg.name]: pkg.version,
    ...(npmVer ? { npm: npmVer } : {}),
    ...process.versions,
  };
}

export async function syncWellKnownVersions(newVersion, targetRoot = rootDir) {
  const filesToSync = [
    path.join(targetRoot, ".well-known/mcp.json"),
    path.join(targetRoot, ".well-known/mcp/server-card.json"),
    path.join(targetRoot, "dist/public/.well-known/mcp.json"),
    path.join(targetRoot, "dist/public/.well-known/mcp/server-card.json"),
  ];

  const updatedFiles = [];
  for (const filePath of filesToSync) {
    if (await pathExists(filePath)) {
      try {
        const content = await readFile(filePath, "utf8");
        const json = JSON.parse(content);
        if (json.version !== newVersion) {
          json.version = newVersion;
          await writeFile(
            filePath,
            JSON.stringify(json, null, 2) + "\n",
            "utf8",
          );
          updatedFiles.push(path.relative(targetRoot, filePath));
        }
      } catch (err) {
        console.warn(`Warning: Could not update version in ${filePath}:`, err);
      }
    }
  }
  return updatedFiles;
}

export async function runVersion(args = process.argv.slice(2), options = {}) {
  const isLifecycle =
    options.isLifecycle ??
    (process.env.npm_command === "version" &&
      process.env.npm_lifecycle_event === "version");
  const targetRoot = options.rootDir || rootDir;
  const execOptions = options.execOptions || {
    cwd: targetRoot,
    stdio: options.stdio || "inherit",
  };

  // 1. If running under npm's lifecycle hook (npm version <newver> triggered this script)
  if (isLifecycle) {
    const pkg = JSON.parse(
      await readFile(path.join(targetRoot, "package.json"), "utf8"),
    );
    const newVersion = pkg.version;
    const updated = await syncWellKnownVersions(newVersion, targetRoot);
    if (
      updated.length > 0 &&
      (await pathExists(path.join(targetRoot, ".git")))
    ) {
      try {
        execSync(
          `git add .well-known/mcp.json .well-known/mcp/server-card.json`,
          { cwd: targetRoot, stdio: "pipe" },
        );
      } catch {}
    }
    return { version: newVersion, updated };
  }

  // 2. Direct CLI invocation
  const targetArg = args.find((a) => !a.startsWith("--")) || args[0];

  // No arguments passed -> list versions mimicking `npm version`
  if (!targetArg) {
    const versionMap = await getVersionMap(targetRoot);
    if (execOptions.stdio === "inherit") {
      console.log(versionMap);
    }
    return { action: "list", versions: versionMap };
  }

  const validation = validateVersionArg(targetArg);
  if (validation.isHelp) {
    if (execOptions.stdio === "inherit") {
      console.log(USAGE_NOTICE);
    }
    return { action: "help", message: USAGE_NOTICE };
  }

  if (validation.error) {
    throw new Error(validation.error);
  }

  const cleanVersion = validation.version;

  // Run npm version --no-git-tag-version --allow-same-version --ignore-scripts
  execSync(
    `npm version ${cleanVersion} --no-git-tag-version --allow-same-version --ignore-scripts`,
    execOptions,
  );

  // Sync .well-known JSON discovery files
  const updated = await syncWellKnownVersions(cleanVersion, targetRoot);

  if (execOptions.stdio === "inherit") {
    console.log(`v${cleanVersion}`);
    if (updated.length > 0) {
      console.log(
        `Updated .well-known discovery versions: ${updated.join(", ")}`,
      );
    }
  }

  return { version: cleanVersion, updated };
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  runVersion().catch((err) => {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  });
}
