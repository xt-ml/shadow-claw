import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function uniqCommand({ db, args, ctx, stdin, ok }) {
  const text =
    args.length > 0
      ? ((await safeRead(db, ctx.groupId, resolvePath(args[0], ctx))) ?? "")
      : stdin;

  const lines = text.split("\n");
  const result = lines.filter((l, i) => i === 0 || l !== lines[i - 1]);

  return { result: ok(result.join("\n")) };
}
