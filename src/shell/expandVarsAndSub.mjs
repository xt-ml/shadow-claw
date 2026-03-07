import { runPipeline } from "./runPipeline.mjs";

/**
 * @typedef {import("./shell.mjs").ShellContext} ShellContext
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Expand shell variables and command substitutions
 *
 * @param {ShadowClawDatabase} db
 * @param {string} str
 * @param {ShellContext} ctx
 *
 * @returns {Promise<string>}
 */
export async function expandVarsAndSub(db, str, ctx) {
  // Variable expansion
  let result = str.replace(/\$\{(\w+)\}/g, (_, name) => ctx.env[name] ?? "");
  result = result.replace(/\$(\w+)/g, (_, name) => ctx.env[name] ?? "");

  // Command substitution
  let finalResult = "";
  let i = 0;
  while (i < result.length) {
    if (result[i] === "$" && result[i + 1] === "(") {
      let depth = 1;
      let start = i;
      let j = i + 2;

      while (j < result.length && depth > 0) {
        if (result[j] === "$" && result[j + 1] === "(") {
          depth++;

          j += 2;

          continue;
        }

        if (result[j] === ")") {
          depth--;
        } else if (result[j] === "(") {
          depth++;
        }

        j++;
      }

      const subCmd = result.slice(start + 2, j - 1);
      const subshellResult = await runPipeline(db, subCmd, ctx);
      finalResult += subshellResult.stdout.replace(/\n+$/, "");
      i = j;
    } else {
      finalResult += result[i];

      i++;
    }
  }

  return finalResult;
}
