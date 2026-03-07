/**
 * ShadowClaw — Lightweight Shell Emulator
 *
 * A minimal bash-like shell that runs entirely in JS using OPFS for the
 * filesystem. Handles the most common commands Claude typically uses.
 * Falls back to the v86 WebVM when available, but works standalone.
 *
 * Supported builtins:
 *   echo, printf, cat, head, tail, wc, grep, sort, uniq, tr, cut, sed, awk,
 *   ls, mkdir, cp, mv, rm, touch, pwd, cd, date, env, printenv, export, true,
 *   false, base64, md5sum/sha256sum (Web Crypto), sleep, seq, jq (basic), tee, test
 *
 * Operators: |  >  >>  &&  ||  ;  $()  ``  $VAR  "interpolation"
 */
import { runPipeline } from "./runPipeline.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * @typedef {Object} ShellResult
 *
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} exitCode
 */

/**
 * @typedef {Object} ShellContext
 *
 * @property {string} groupId
 * @property {string} cwd
 * @property {Record<string, string>} env
 * @property {number} timeoutMs
 * @property {number} startedAt
 */

/**
 * Execute a shell command string against a group's OPFS workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} command
 * @param {string} groupId
 * @param {Record<string, string>} [env={}]
 * @param {number} [timeoutSec=30]
 *
 * @returns {Promise<ShellResult>}
 */
export async function executeShell(
  db,
  command,
  groupId,
  env = {},
  timeoutSec = 30,
) {
  const ctx = {
    groupId,
    cwd: ".",
    env: { HOME: "/workspace", PATH: "/usr/bin", PWD: "/workspace", ...env },
    timeoutMs: timeoutSec * 1000,
    startedAt: Date.now(),
  };

  try {
    return await runPipeline(db, command.trim(), ctx);
  } catch (err) {
    return {
      stdout: "",
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
    };
  }
}

// ---------------------------------------------------------------------------
// Pipeline / operator parsing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Single command execution
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

export const SUPPORTED_COMMANDS = new Set([
  "echo",
  "printf",
  "cat",
  "head",
  "tail",
  "wc",
  "grep",
  "sort",
  "uniq",
  "tr",
  "cut",
  "sed",
  "awk",
  "ls",
  "mkdir",
  "cp",
  "mv",
  "rm",
  "touch",
  "pwd",
  "cd",
  "date",
  "env",
  "printenv",
  "export",
  "sleep",
  "seq",
  "true",
  "false",
  "test",
  "base64",
  "md5sum",
  "sha256sum",
  "tee",
  "basename",
  "dirname",
  "xargs",
  "rev",
  "yes",
  "jq",
  "which",
  "command",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
