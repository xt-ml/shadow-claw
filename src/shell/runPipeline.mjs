import { checkTimeout } from "./checkTimeout.mjs";
import { runPipe } from "./runPipe.mjs";
import { runSingle } from "./runSingle.mjs";
import { splitOnOperators } from "./splitOnOperators.mjs";

/**
 * @typedef {import("./shell.mjs").ShellContext} ShellContext
 * @typedef {import("./shell.mjs").ShellResult} ShellResult
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Run a pipeline of commands
 *
 * @param {ShadowClawDatabase} db
 * @param {string} line
 * @param {ShellContext} ctx
 *
 * @returns {Promise<ShellResult>}
 */
export async function runPipeline(db, line, ctx) {
  const segments = splitOnOperators(line);
  let lastResult = {
    stdout: "",
    stderr: "",
    exitCode: 0,
  };

  for (const seg of segments) {
    checkTimeout(ctx);
    const { cmd, op } = seg;
    if (!cmd.trim()) {
      continue;
    }

    if (cmd.includes("|") && !cmd.includes("||")) {
      lastResult = await runPipe(db, cmd, ctx);
    } else {
      lastResult = await runSingle(db, cmd.trim(), ctx);
    }

    if (op === "&&" && lastResult.exitCode !== 0) {
      break;
    }

    if (op === "||" && lastResult.exitCode === 0) {
      break;
    }
  }

  return lastResult;
}
