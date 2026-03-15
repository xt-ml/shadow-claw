import { safeRead } from "../safeRead.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

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

/** @type {ShellCommandHandler} */
export async function readlinkCommand({ db, args, ctx, ok, fail }) {
  let canonicalize = false; // -f or -m
  let noNewline = false; // -n
  /** @type {string[]} */
  const operands = [];

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "-f" || token === "-m") {
      canonicalize = true;
    } else if (token === "-n") {
      noNewline = true;
    } else if (token === "-nf" || token === "-fn") {
      canonicalize = true;
      noNewline = true;
    } else if (token.startsWith("-") && token.length > 1) {
      // Absorb unknown silent flags (-q, -e, -z, combinations) rather than
      // erroring; readlink is often called with tolerated unknown flags.
      if (token.includes("f") || token.includes("m")) {
        canonicalize = true;
      }

      if (token.includes("n")) {
        noNewline = true;
      }
    } else {
      operands.push(token);
    }
  }

  if (canonicalize) {
    // -f / -m: canonicalize path, no symlink-following required
    const lines = operands.map((op) => {
      const vfsPath = resolvePath(op, ctx);
      return toAbsolute(vfsPath, ctx);
    });

    const sep = noNewline ? "" : "\n";
    const out = noNewline ? lines.join("\n") : lines.join("\n") + "\n";
    return { result: ok(out) };
  }

  // Without -f/-m: operand must be a symlink (not supported in VFS)
  // Any file or missing path → exit 1
  if (operands.length === 0) {
    return { result: fail("readlink: missing operand") };
  }

  // Check if something useful can be said (file vs missing)
  const path = resolvePath(operands[0], ctx);
  const content = await safeRead(db, ctx.groupId, path);
  // Regular files and missing paths both fail: neither is a symlink
  void content;
  return { result: fail("") };
}
