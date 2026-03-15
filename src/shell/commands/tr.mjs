import { escapeRegex } from "../escapeRegex.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function trCommand({ args, stdin, ok, fail }) {
  const text = stdin;

  if (args[0] === "-t") {
    if (args.length < 3) {
      return { result: fail("tr: missing operands") };
    }

    const from = args[1].slice(0, args[2].length);
    const to = args[2];
    let result = text;

    for (let i = 0; i < from.length; i++) {
      const replacement = i < to.length ? to[i] : "";
      result = result.replace(
        new RegExp(escapeRegex(from[i]), "g"),
        replacement,
      );
    }

    return { result: ok(result) };
  }

  if (args[0] === "-s" && args[1]) {
    const chars = args[1];
    const pattern = new RegExp(`([${escapeRegex(chars)}])\\1+`, "g");
    return { result: ok(text.replace(pattern, "$1")) };
  }

  if (args[0] === "-d" && args[1]) {
    const chars = args[1];
    return {
      result: ok(text.replace(new RegExp(`[${escapeRegex(chars)}]`, "g"), "")),
    };
  }

  if (args.length >= 2) {
    const from = args[0];
    const to = args[1];

    let result = text;
    for (let i = 0; i < from.length; i++) {
      const replacement = i < to.length ? to[i] : to[to.length - 1];
      result = result.replace(
        new RegExp(escapeRegex(from[i]), "g"),
        replacement,
      );
    }

    return { result: ok(result) };
  }

  return { result: fail("tr: missing operands") };
}
