import { writeGroupFile } from "../storage/writeGroupFile.mjs";
import { checkTimeout } from "./checkTimeout.mjs";
import { dispatch } from "./dispatch.mjs";
import { expandVarsAndSub } from "./expandVarsAndSub.mjs";
import { resolvePath } from "./resolvePath.mjs";
import { safeRead } from "./safeRead.mjs";
import { tokenize } from "./tokenize.mjs";

/**
 * @typedef {import("./shell.mjs").ShellContext} ShellContext
 * @typedef {import("./shell.mjs").ShellResult} ShellResult
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Run a single command
 *
 * @param {ShadowClawDatabase} db
 * @param {string} raw
 * @param {ShellContext} ctx
 * @param {string} [stdin='']
 *
 * @returns {Promise<ShellResult>}
 */
export async function runSingle(db, raw, ctx, stdin = "") {
  checkTimeout(ctx);

  let appendFile = null;
  let writeFile = null;
  let cmdStr = raw.trim();

  while (true) {
    let matched = false;

    const stderrMatch = cmdStr.match(/\s*2>&1\s*$/);
    if (stderrMatch) {
      cmdStr = cmdStr.slice(0, stderrMatch.index).trim();
      matched = true;
      continue;
    }

    const appendMatch = cmdStr.match(/\s*>>\s*(\S+)\s*$/);
    if (appendMatch) {
      if (!appendFile && !writeFile) appendFile = appendMatch[1];
      cmdStr = cmdStr.slice(0, appendMatch.index).trim();
      matched = true;
      continue;
    }

    const writeMatch = cmdStr.match(/\s*>\s*(\S+)\s*$/);
    if (writeMatch) {
      if (!writeFile && !appendFile) writeFile = writeMatch[1];
      cmdStr = cmdStr.slice(0, writeMatch.index).trim();
      matched = true;
      continue;
    }

    if (!matched) break;
  }

  const pseudoFiles = ["&1", "&2", "/dev/null", "dev/null"];
  if (writeFile && pseudoFiles.includes(writeFile)) writeFile = null;
  if (appendFile && pseudoFiles.includes(appendFile)) appendFile = null;

  cmdStr = await expandVarsAndSub(db, cmdStr, ctx);
  const tokens = tokenize(cmdStr);
  if (tokens.length === 0) return { stdout: "", stderr: "", exitCode: 0 };

  const name = tokens[0];
  const args = tokens.slice(1);

  // Variable assignment
  if (/^[A-Za-z_]\w*=/.test(name) && args.length === 0) {
    const eq = name.indexOf("=");
    ctx.env[name.slice(0, eq)] = name.slice(eq + 1);
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  const result = await dispatch(db, name, args, ctx, stdin);

  // Apply redirects
  if (typeof writeFile === "string") {
    await writeGroupFile(
      db,
      ctx.groupId,
      resolvePath(writeFile, ctx),
      result.stdout,
    );

    return { stdout: "", stderr: result.stderr, exitCode: result.exitCode };
  }
  if (typeof appendFile === "string") {
    const path = resolvePath(appendFile, ctx);
    const existing = (await safeRead(db, ctx.groupId, path)) || "";
    await writeGroupFile(db, ctx.groupId, path, existing + result.stdout);
    return { stdout: "", stderr: result.stderr, exitCode: result.exitCode };
  }

  return result;
}
