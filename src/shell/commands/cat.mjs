import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function catCommand({ db, args, ctx, stdin, ok, fail }) {
  if (args.length === 0 && stdin) {
    return { result: ok(stdin) };
  }

  const parts = [];
  for (const f of args) {
    if (f === "-") {
      parts.push(stdin);

      continue;
    }

    const content = await safeRead(db, ctx.groupId, resolvePath(f, ctx));
    if (content === null) {
      return { result: fail(`cat: ${f}: No such file`) };
    }

    parts.push(content);
  }

  return { result: ok(parts.join("")) };
}
