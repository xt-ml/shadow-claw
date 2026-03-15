import { escapeRegex } from "../escapeRegex.mjs";
import { parseFlags } from "../parseFlags.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function basenameCommand({ args, ok }) {
  const { flags, operands } = parseFlags(args, ["s"], ["a"]);
  const allMode =
    Object.prototype.hasOwnProperty.call(flags, "a") ||
    Object.prototype.hasOwnProperty.call(flags, "s");

  const explicitSuffix = flags.s;
  const suffix =
    explicitSuffix !== undefined
      ? explicitSuffix
      : !allMode && operands.length > 1
        ? operands[1]
        : undefined;

  /** @param {string} path */
  const toBasename = (path) => {
    const trimmed = path.replace(/\/+$/, "");
    if (!trimmed) {
      return "/";
    }

    const parts = trimmed.split("/");
    return parts[parts.length - 1] || "/";
  };

  /** @param {string} value */
  const maybeStripSuffix = (value) => {
    if (!suffix || suffix.length === 0) {
      return value;
    }

    if (value === suffix) {
      return value;
    }

    return value.replace(new RegExp(escapeRegex(suffix) + "$"), "");
  };

  const paths = allMode ? operands : [operands[0] ?? ""];
  const output = paths
    .map((path) => maybeStripSuffix(toBasename(path)))
    .join("\n");

  if (output.length === 0) {
    return { result: ok("\n") };
  }

  return { result: ok(output + "\n") };
}
