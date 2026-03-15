import { writeGroupFile } from "../../storage/writeGroupFile.mjs";
import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function touchCommand({ db, args, ctx, ok }) {
  const { flags, operands } = parseFlags(args, ["t"], ["c"]);

  for (const f of operands) {
    const path = resolvePath(f, ctx);
    const existing = await safeRead(db, ctx.groupId, path);
    if (existing === null && flags.c === undefined) {
      await writeGroupFile(db, ctx.groupId, path, "");
    }
  }

  return { result: ok("") };
}
