import { checkTimeout } from "./checkTimeout.mjs";
import { runSingle } from "./runSingle.mjs";

/**
 * @typedef {import("./shell.mjs").ShellContext} ShellContext
 * @typedef {import("./shell.mjs").ShellResult} ShellResult
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Run piped commands
 *
 * @param {ShadowClawDatabase} db
 * @param {string} line
 * @param {ShellContext} ctx
 *
 * @returns {Promise<ShellResult>}
 */
export async function runPipe(db, line, ctx) {
  const parts = [];

  let current = "";
  let inSingle = false;
  let inDouble = false;
  let subshellDepth = 0;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;

      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;

      continue;
    }

    if (!inSingle) {
      if (ch === "$" && line[i + 1] === "(") {
        subshellDepth++;
        current += "$(";
        i++;

        continue;
      }

      if (ch === "(") {
        subshellDepth++;
      }

      if (ch === ")") {
        if (subshellDepth > 0) subshellDepth--;
      }
    }

    if (ch === "|" && !inSingle && !inDouble && subshellDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current.trim());

  let lastResult = { stdout: "", stderr: "", exitCode: 0 };

  for (const part of parts) {
    checkTimeout(ctx);
    lastResult = await runSingle(db, part, ctx, lastResult.stdout);
  }

  return lastResult;
}
