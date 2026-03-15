import { writeGroupFile } from "../../storage/writeGroupFile.mjs";
import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function mkdirCommand({ db, args, ctx, ok, fail }) {
  const { flags, operands } = parseFlags(args, [], ["p", "v"]);
  const out = [];

  for (const dir of operands) {
    try {
      await writeGroupFile(
        db,
        ctx.groupId,
        resolvePath(dir + "/.keep", ctx),
        "",
      );
      if (flags.v !== undefined) {
        out.push(`mkdir: created directory '${dir}'`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.p !== undefined && /exist/iu.test(message)) {
        continue;
      }

      return { result: fail(`mkdir: cannot create directory '${dir}'`) };
    }
  }

  return { result: ok(out.length > 0 ? `${out.join("\n")}\n` : "") };
}
