/**
 * ShadowClaw — Lightweight Shell Emulator
 *
 * A minimal bash-like shell that runs entirely in JS.
 *
 * Supported builtins:
 *   echo, printf, cat, head, tail, wc, grep, sort, uniq, tr, cut, sed, awk,
 *   ls, find, mkdir, cp, mv, rm, touch, pwd, cd, date, env, printenv, export,
 *   true, false, base64, md5sum, sha1sum, sha256sum, sha384sum, sha512sum,
 *   sleep, seq, jq (basic), tee, test, diff, du, readlink, realpath,
 *   tar (internal format)
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
 * Execute a shell command string against the workspace.
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

export const SUPPORTED_COMMANDS = new Set([
  "awk",
  "base64",
  "basename",
  "cat",
  "cd",
  "command",
  "cp",
  "cut",
  "date",
  "diff",
  "dirname",
  "du",
  "echo",
  "env",
  "export",
  "false",
  "find",
  "grep",
  "head",
  "jq",
  "ls",
  "md5sum",
  "mkdir",
  "mv",
  "printenv",
  "printf",
  "pwd",
  "rev",
  "rm",
  "readlink",
  "realpath",
  "tar",
  "sed",
  "seq",
  "sha1sum",
  "sha256sum",
  "sha384sum",
  "sha512sum",
  "sleep",
  "sort",
  "tail",
  "tee",
  "test",
  "touch",
  "tr",
  "true",
  "uniq",
  "wc",
  "which",
  "xargs",
  "yes",
]);
