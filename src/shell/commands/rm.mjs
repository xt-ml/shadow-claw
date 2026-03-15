import { deleteGroupDirectory } from "../../storage/deleteGroupDirectory.mjs";
import { deleteGroupFile } from "../../storage/deleteGroupFile.mjs";
import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function rmCommand({ db, args, ctx, ok, fail }) {
  const { flags, operands } = parseFlags(args, [], ["r", "f"]);
  const verboseLines = [];

  for (const f of operands) {
    try {
      const path = resolvePath(f, ctx);
      if (flags.r !== undefined) {
        await deleteGroupDirectory(db, ctx.groupId, path);
        if (flags.v !== undefined) {
          verboseLines.push(`removed directory '${f}'`);
        }
      } else {
        await deleteGroupFile(db, ctx.groupId, path);
        if (flags.v !== undefined) {
          verboseLines.push(`removed '${f}'`);
        }
      }
    } catch {
      if (flags.f === undefined) {
        return { result: fail(`rm: ${f}: No such file or directory`) };
      }
    }
  }
  const stdout = verboseLines.length > 0 ? `${verboseLines.join("\n")}\n` : "";
  return { result: ok(stdout) };
}
