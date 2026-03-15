import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function tailCommand({ db, args, ctx, stdin, ok }) {
  let mode = "n";
  let count = 10;
  let fromStart = false;
  const operands = [];

  /** @param {string} value */
  const parseCount = (value) => {
    if (value.startsWith("+")) {
      fromStart = true;
      count = parseInt(value.slice(1), 10);
      return;
    }

    fromStart = false;
    count = parseInt(value, 10);
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") {
      operands.push(...args.slice(i + 1));

      break;
    }

    if (/^-[0-9]+$/u.test(arg)) {
      mode = "n";
      fromStart = false;
      count = parseInt(arg.slice(1), 10);

      continue;
    }

    if (arg === "-n" || arg === "-c") {
      const next = args[i + 1];
      if (next !== undefined) {
        mode = arg === "-n" ? "n" : "c";
        parseCount(next);
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
    if (fromStart) {
      return { result: ok(text.slice(Math.max(0, count - 1))) };
    }

    return { result: ok(text.slice(Math.max(0, text.length - count))) };
  }

  const hasTrailingNewline = text.endsWith("\n");
  const lines = text.split("\n");
  if (hasTrailingNewline) {
    lines.pop();
  }

  const selected = fromStart
    ? lines.slice(Math.max(0, count - 1))
    : lines.slice(Math.max(0, lines.length - count));

  let output = selected.join("\n");
  if (hasTrailingNewline && output.length > 0) {
    output += "\n";
  }

  return { result: ok(output) };
}
