import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function sortCommand({ db, args, ctx, stdin, ok }) {
  const { flags, operands } = parseFlags(args, [], ["r", "n", "u", "c"]);
  const text =
    operands.length > 0
      ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ?? "")
      : stdin;

  let lines = text.split("\n").filter(Boolean);

  if (flags.c !== undefined) {
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1];
      const curr = lines[i];

      const prevKey = flags.n !== undefined ? Number.parseFloat(prev) : prev;
      const currKey = flags.n !== undefined ? Number.parseFloat(curr) : curr;
      const order = prevKey < currKey ? -1 : prevKey > currKey ? 1 : 0;
      const effectiveOrder = flags.r !== undefined ? -order : order;

      if (effectiveOrder > 0) {
        return { result: { stdout: "", stderr: "", exitCode: 1 } };
      }

      if (flags.u !== undefined && order === 0) {
        return { result: { stdout: "", stderr: "", exitCode: 1 } };
      }
    }

    return { result: { stdout: "", stderr: "", exitCode: 0 } };
  }

  if (flags.n !== undefined) {
    lines.sort((a, b) => parseFloat(a) - parseFloat(b));
  } else {
    lines.sort();
  }

  if (flags.r !== undefined) {
    lines.reverse();
  }

  if (flags.u !== undefined) {
    lines = [...new Set(lines)];
  }

  return { result: ok(lines.join("\n") + "\n") };
}
