import { writeGroupFile } from "../../storage/writeGroupFile.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function cpCommand({ db, args, ctx, ok, fail }) {
  if (args.length < 2) {
    return { result: fail("cp: missing operands") };
  }

  const src = resolvePath(args[0], ctx);
  const dst = resolvePath(args[1], ctx);
  const content = await safeRead(db, ctx.groupId, src);
  if (content === null) {
    return { result: fail(`cp: ${args[0]}: No such file`) };
  }

  await writeGroupFile(db, ctx.groupId, dst, content);

  return { result: ok("") };
}
