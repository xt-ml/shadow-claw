import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function headCommand({ db, args, ctx, stdin, ok }) {
  let mode = "n";
  let count = 10;
  const operands = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") {
      operands.push(...args.slice(i + 1));

      break;
    }

    if (/^-[0-9]+$/u.test(arg)) {
      mode = "n";
      count = parseInt(arg.slice(1), 10);

      continue;
    }

    if (arg === "-n" || arg === "-c") {
      const next = args[i + 1];
      if (next !== undefined) {
        mode = arg === "-n" ? "n" : "c";
        count = parseInt(next, 10);
        i++;
      }
      continue;
    }

    operands.push(arg);
  }

  if (!Number.isFinite(count) || count < 0) {
    count = 0;
  }

  const text =
    operands.length > 0 && operands[0] !== "-"
      ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ?? "")
      : stdin;

  if (mode === "c") {
    return { result: ok(text.slice(0, count)) };
  }

  return { result: ok(text.split("\n").slice(0, count).join("\n") + "\n") };
}
