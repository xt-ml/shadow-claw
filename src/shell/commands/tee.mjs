import { writeGroupFile } from "../../storage/writeGroupFile.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function teeCommand({ db, args, ctx, stdin, ok }) {
  const text = stdin;
  for (const f of args) {
    await writeGroupFile(db, ctx.groupId, resolvePath(f, ctx), text);
  }

  return { result: ok(text) };
}
