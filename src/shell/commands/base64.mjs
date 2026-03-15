import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/**
 * @param {string} text
 * @param {number} width
 *
 * @returns {string}
 */
function wrapText(text, width) {
  if (width <= 0) {
    return text;
  }

  /** @type {string[]} */
  const lines = [];
  for (let offset = 0; offset < text.length; offset += width) {
    lines.push(text.slice(offset, offset + width));
  }

  return lines.join("\n");
}

/** @type {ShellCommandHandler} */
export async function base64Command({ db, args, ctx, stdin, ok, fail }) {
  let decode = false;
  let wrap = 76;
  /** @type {string[]} */
  const operands = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-d" || arg === "--decode") {
      decode = true;

      continue;
    }

    if (arg === "-w") {
      const value = args[index + 1] ?? "";
      wrap = Number.parseInt(value, 10);
      index += 1;

      continue;
    }

    if (/^-w\d+$/u.test(arg)) {
      wrap = Number.parseInt(arg.slice(2), 10);

      continue;
    }

    operands.push(arg);
  }

  if (Number.isNaN(wrap)) {
    return { result: fail("base64: invalid wrap width") };
  }

  const source = operands[0];
  const text =
    source !== undefined
      ? await safeRead(db, ctx.groupId, resolvePath(source, ctx))
      : stdin;

  if (text === null) {
    return {
      result: fail(`base64: ${source}: No such file or directory`),
    };
  }

  if (decode) {
    return { result: ok(atob(text.replace(/\s+/gu, ""))) };
  }

  const encoded = btoa(text);
  return { result: ok(`${wrapText(encoded, wrap)}\n`) };
}
