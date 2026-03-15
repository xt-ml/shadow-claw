import { deleteGroupFile } from "../../storage/deleteGroupFile.mjs";
import { writeGroupFile } from "../../storage/writeGroupFile.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function mvCommand({ db, args, ctx, ok, fail }) {
  if (args.length < 2) {
    return { result: fail("mv: missing operands") };
  }

  const src = resolvePath(args[0], ctx);
  const dst = resolvePath(args[1], ctx);
  const content = await safeRead(db, ctx.groupId, src);
  if (content === null) {
    return { result: fail(`mv: ${args[0]}: No such file`) };
  }

  await writeGroupFile(db, ctx.groupId, dst, content);
  await deleteGroupFile(db, ctx.groupId, src);

  return { result: ok("") };
}
