/**
 * ShadowClaw CLI — Cache and Database Directory Resolver
 *
 * Resolves the cache directory from:
 * 1. CLI flags (--tmp/--temp, --cache-dir)
 * 2. Environment variables (SHADOWCLAW_TMP, SHADOWCLAW_CACHE_DIR)
 * 3. Native ShadowClaw configuration file (site-config.json)
 * 4. Existing .cache directory or database files
 * 5. Interactive user prompt (if stdin is a TTY and no existing cache is detected)
 *    offering ./.cache, system tmpdir (via node:os tmpdir), or custom path.
 */

import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

/**
 * Returns the default system temporary cache directory for ShadowClaw.
 */
export function getSystemTmpCacheDir() {
  return path.join(tmpdir(), "shadow-claw");
}

/**
 * Reads cacheDir from native ShadowClaw config files (site-config.json or shadowclaw.config.json).
 */
export function readConfigFileCacheDir(contentRoot) {
  const root = path.resolve(contentRoot || process.cwd());
  const configFiles = [
    path.join(root, "shadow-claw-config.json"),
    path.join(root, "shadow-claw.config.json"),
    path.join(root, "shadowclaw.config.json"),
    path.join(root, "pages", "shadow-claw-config.json"),
    path.join(root, "pages", "shadow-claw.config.json"),
    path.join(root, "site-config.json"),
    path.join(root, "pages", "site-config.json"),
  ];

  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      try {
        const content = fs.readFileSync(configFile, "utf8");
        const parsed = JSON.parse(content);
        if (
          parsed &&
          typeof parsed.cacheDir === "string" &&
          parsed.cacheDir.trim()
        ) {
          return path.resolve(root, parsed.cacheDir.trim());
        }
        if (
          parsed &&
          parsed.server &&
          typeof parsed.server.cacheDir === "string" &&
          parsed.server.cacheDir.trim()
        ) {
          return path.resolve(root, parsed.server.cacheDir.trim());
        }
      } catch (_) {}
    }
  }

  return null;
}

/**
 * Checks if a .cache directory or any existing runtime files are present.
 */
export function detectExistingCache(
  contentRoot,
  defaultCacheDirName = ".cache",
) {
  const root = path.resolve(contentRoot || process.cwd());
  const cacheDir = path.join(root, defaultCacheDirName);
  const databaseDir = path.join(cacheDir, "database");

  const candidates = [
    cacheDir,
    path.join(cacheDir, "control-token.json"),
    path.join(cacheDir, "cli-peer-id"),
    databaseDir,
    path.join(databaseDir, "clients.db"),
    path.join(databaseDir, "scheduled-tasks.db"),
    path.join(databaseDir, "push-subscriptions.db"),
    path.join(root, "database", "clients.db"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return true;
    }
  }

  return false;
}

/**
 * Interactively prompts the user for a cache directory choice.
 */
export async function promptForCacheDir({
  contentRoot,
  stdin = process.stdin,
  stdout = process.stdout,
  onExit = (code) => process.exit(code),
} = {}) {
  const root = path.resolve(contentRoot || process.cwd());
  const defaultLocalCache = path.join(root, ".cache");
  const systemTmpCache = getSystemTmpCacheDir();

  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });

  let exited = false;
  const handleSigint = () => {
    if (exited) return;
    exited = true;
    stdout.write("\nOperation cancelled.\n");
    try {
      rl.close();
    } catch (_) {}
    onExit(130);
  };

  rl.on("SIGINT", handleSigint);
  if (stdin && typeof stdin.on === "function" && stdin !== process.stdin) {
    stdin.on("SIGINT", handleSigint);
  }
  const processSigintListener = () => handleSigint();
  process.on("SIGINT", processSigintListener);

  try {
    stdout.write(
      "\nShadowClaw needs a directory to store cache and database files:\n",
    );
    stdout.write("  - .cache/control-token.json\n");
    stdout.write(
      "  - .cache/database/ (clients.db, scheduled-tasks.db, push-subscriptions.db)\n\n",
    );
    stdout.write(
      `No existing .cache directory was detected in:\n  ${root}\n\n`,
    );
    stdout.write("Where would you like to store these files?\n");
    stdout.write(
      `  1) Current directory (${path.relative(process.cwd(), defaultLocalCache) || ".cache"}) [default]\n`,
    );
    stdout.write(`  2) System temporary directory (${systemTmpCache})\n`);
    stdout.write("  3) Custom directory path\n\n");
    stdout.write(
      'Tip: You can pass --tmp, --cache-dir <dir>, set SHADOWCLAW_TMP=1, SHADOWCLAW_CACHE_DIR=<dir>, or configure "cacheDir" in shadow-claw.config.json to skip this prompt.\n\n',
    );

    const answer = (
      await rl.question("Enter choice [1-3] or a directory path (default: 1): ")
    ).trim();

    if (
      !answer ||
      answer === "1" ||
      answer.toLowerCase() === "y" ||
      answer.toLowerCase() === "yes"
    ) {
      stdout.write(`Using current directory cache: ${defaultLocalCache}\n\n`);
      return defaultLocalCache;
    }

    if (
      answer === "2" ||
      answer.toLowerCase() === "tmp" ||
      answer.toLowerCase() === "temp" ||
      answer.toLowerCase() === "t"
    ) {
      stdout.write(`Using temporary directory: ${systemTmpCache}\n\n`);
      return systemTmpCache;
    }

    if (answer.toLowerCase() === "n" || answer.toLowerCase() === "no") {
      const fallback = (
        await rl.question(
          `Use temporary directory (${systemTmpCache}) instead? (Y/n): `,
        )
      ).trim();
      if (fallback.toLowerCase() === "n" || fallback.toLowerCase() === "no") {
        stdout.write("Operation cancelled.\n");
        onExit(0);
        return systemTmpCache;
      }
      stdout.write(`Using temporary directory: ${systemTmpCache}\n\n`);
      return systemTmpCache;
    }

    if (
      answer === "3" ||
      answer.toLowerCase() === "c" ||
      answer.toLowerCase() === "custom"
    ) {
      const customPath = (
        await rl.question("Enter custom directory path: ")
      ).trim();
      if (!customPath) {
        stdout.write(`Using current directory cache: ${defaultLocalCache}\n\n`);
        return defaultLocalCache;
      }
      const resolved = path.resolve(root, customPath);
      stdout.write(`Using custom directory: ${resolved}\n\n`);
      return resolved;
    }

    // Direct path entered
    const resolved = path.resolve(root, answer);
    stdout.write(`Using directory: ${resolved}\n\n`);
    return resolved;
  } finally {
    process.removeListener("SIGINT", processSigintListener);
    if (
      stdin &&
      typeof stdin.removeListener === "function" &&
      stdin !== process.stdin
    ) {
      stdin.removeListener("SIGINT", handleSigint);
    }
    rl.close();
  }
}

/**
 * Resolves cacheDir and databaseDir from CLI flags, env vars, config files,
 * existing files, or interactive prompt.
 */
export async function resolveCacheDir(options = {}) {
  const contentRoot = path.resolve(options.contentRoot || process.cwd());

  // 1. Explicit --tmp / --temp flag or SHADOWCLAW_TMP env var
  const isTmp = Boolean(
    options.tmp ||
    options.temp ||
    ["1", "true", "yes"].includes(
      (process.env.SHADOWCLAW_TMP || process.env.SHADOWCLAW_TEMP || "")
        .toLowerCase()
        .trim(),
    ),
  );

  if (isTmp) {
    const cacheDir = getSystemTmpCacheDir();
    const databaseDir = options.databaseDir
      ? path.resolve(contentRoot, options.databaseDir)
      : path.join(cacheDir, "database");
    return { cacheDir, databaseDir };
  }

  // 2. Explicit --cache-dir flag or SHADOWCLAW_CACHE_DIR env var
  const explicitCacheDir = (
    options.cacheDir ||
    process.env.SHADOWCLAW_CACHE_DIR ||
    ""
  ).trim();

  if (explicitCacheDir) {
    const cacheDir = path.resolve(contentRoot, explicitCacheDir);
    const databaseDir = options.databaseDir
      ? path.resolve(contentRoot, options.databaseDir)
      : path.join(cacheDir, "database");
    return { cacheDir, databaseDir };
  }

  // 3. Explicit --database-dir flag or SHADOWCLAW_DATABASE_DIR env var
  const explicitDatabaseDir = (
    options.databaseDir ||
    process.env.SHADOWCLAW_DATABASE_DIR ||
    ""
  ).trim();

  if (explicitDatabaseDir) {
    const databaseDir = path.resolve(contentRoot, explicitDatabaseDir);
    const cacheDir =
      path.basename(databaseDir) === "database"
        ? path.dirname(databaseDir)
        : path.resolve(databaseDir, "..");
    return { cacheDir, databaseDir };
  }

  // 4. Native ShadowClaw configuration file (site-config.json or shadowclaw.config.json)
  const configCacheDir = readConfigFileCacheDir(contentRoot);
  if (configCacheDir) {
    const databaseDir = path.join(configCacheDir, "database");
    return { cacheDir: configCacheDir, databaseDir };
  }

  // 5. If existing cache/database is detected, use .cache without prompting
  const exists = detectExistingCache(contentRoot);
  const defaultCacheDir = path.join(contentRoot, ".cache");
  const defaultDatabaseDir = path.join(defaultCacheDir, "database");

  if (exists) {
    return { cacheDir: defaultCacheDir, databaseDir: defaultDatabaseDir };
  }

  // 6. Skip prompting if --yes / -y flag or SHADOWCLAW_YES is passed
  const isYes = Boolean(
    options.yes ||
    options.y ||
    ["1", "true", "yes"].includes(
      (process.env.SHADOWCLAW_YES || "").toLowerCase().trim(),
    ),
  );

  if (isYes) {
    return { cacheDir: defaultCacheDir, databaseDir: defaultDatabaseDir };
  }

  // 7. Non-interactive environment guard (not a TTY or CI=true)
  const isTTY =
    options.isTTY !== undefined
      ? Boolean(options.isTTY)
      : Boolean(options.stdin ? options.stdin.isTTY : process.stdin.isTTY);

  const isCI =
    options.isCI !== undefined
      ? Boolean(options.isCI)
      : options.isTTY !== undefined
        ? false
        : Boolean(
            process.env.CI &&
            !["0", "false"].includes(process.env.CI.toLowerCase()),
          );

  if (!isTTY || isCI) {
    return { cacheDir: defaultCacheDir, databaseDir: defaultDatabaseDir };
  }

  // 8. Interactive prompt
  const chosenCacheDir = await promptForCacheDir({
    contentRoot,
    stdin: options.stdin,
    stdout: options.stdout,
    onExit: options.onExit,
  });

  return {
    cacheDir: chosenCacheDir,
    databaseDir: path.join(chosenCacheDir, "database"),
  };
}
