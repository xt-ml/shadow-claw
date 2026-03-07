import { groupFileExists } from "../storage/groupFileExists.mjs";
import { listGroupFiles } from "../storage/listGroupFiles.mjs";

import { resolvePath } from "./resolvePath.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("./shell.mjs").ShellContext} ShellContext
 * @typedef {import("./shell.mjs").ShellResult} ShellResult
 */

/**
 * Handle test expressions
 *
 * @param {ShadowClawDatabase} db
 * @param {string[]} args
 * @param {ShellContext} ctx
 *
 * @returns {Promise<ShellResult>}
 */
export async function testExpr(db, args, ctx) {
  const ok = { stdout: "", stderr: "", exitCode: 0 };
  const no = { stdout: "", stderr: "", exitCode: 1 };

  if (args.length === 0) return no;

  // Unary: -f file, -d dir, -z str, -n str, -e file
  if (args.length === 2) {
    switch (args[0]) {
      case "-f":
      case "-e":
        return (await groupFileExists(
          db,
          ctx.groupId,
          resolvePath(args[1], ctx),
        ))
          ? ok
          : no;
      case "-d":
        // Check if directory exists by trying to list it
        try {
          await listGroupFiles(db, ctx.groupId, resolvePath(args[1], ctx));

          return ok;
        } catch {
          return no;
        }
      case "-z":
        return args[1].length === 0 ? ok : no;
      case "-n":
        return args[1].length > 0 ? ok : no;
    }
  }

  // Binary: str = str, str != str, num -eq num, etc.
  if (args.length === 3) {
    const [left, op, right] = args;
    switch (op) {
      case "=":
      case "==":
        return left === right ? ok : no;
      case "!=":
        return left !== right ? ok : no;
      case "-eq":
        return Number(left) === Number(right) ? ok : no;
      case "-ne":
        return Number(left) !== Number(right) ? ok : no;
      case "-lt":
        return Number(left) < Number(right) ? ok : no;
      case "-le":
        return Number(left) <= Number(right) ? ok : no;
      case "-gt":
        return Number(left) > Number(right) ? ok : no;
      case "-ge":
        return Number(left) >= Number(right) ? ok : no;
    }
  }

  // Negation
  if (args[0] === "!") {
    return (await testExpr(db, args.slice(1), ctx)).exitCode === 0 ? no : ok;
  }

  return no;
}
