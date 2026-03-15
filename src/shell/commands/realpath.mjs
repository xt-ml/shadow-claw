import { listGroupFiles } from "../../storage/listGroupFiles.mjs";
import { safeRead } from "../safeRead.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */
/** @typedef {import("../../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase */

/**
 * Convert a VFS relative path to a /workspace-rooted absolute path.
 *
 * @param {string} vfsPath
 * @param {import("../shell.mjs").ShellContext} ctx
 *
 * @returns {string}
 */
function toAbsolute(vfsPath, ctx) {
  const pwd = (ctx.env.PWD ?? "/workspace").replace(/\/+$/, "");
  if (vfsPath === ".") return pwd;
  return `${pwd}/${vfsPath}`;
}

/**
 * Check if a path exists as either a file or directory in the VFS.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} vfsPath
 *
 * @returns {Promise<boolean>}
 */
async function existsInVfs(db, groupId, vfsPath) {
  try {
    await listGroupFiles(db, groupId, vfsPath);
    return true;
  } catch {
    const content = await safeRead(db, groupId, vfsPath);
    return content !== null;
  }
}

/** @type {ShellCommandHandler} */
export async function realpathCommand({ db, args, ctx, ok, fail }) {
  let mustExist = false;

  /** @type {string[]} */
  const operands = [];

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "-e") {
      mustExist = true;
    } else if (token === "-m") {
      mustExist = false;
    } else if (token.startsWith("-") && token.length > 1) {
      // Absorb other flags silently (e.g. -s, -L, --relative-to)
      if (token.includes("e")) mustExist = true;
    } else {
      operands.push(token);
    }
  }

  if (operands.length === 0) {
    return { result: fail("realpath: missing operand") };
  }

  /** @type {string[]} */
  const lines = [];

  for (const op of operands) {
    const vfsPath = resolvePath(op, ctx);

    if (mustExist) {
      const found = await existsInVfs(db, ctx.groupId, vfsPath);
      if (!found) {
        return {
          result: fail(`realpath: ${op}: No such file or directory`),
        };
      }
    }

    lines.push(toAbsolute(vfsPath, ctx));
  }

  return { result: ok(lines.join("\n") + "\n") };
}
