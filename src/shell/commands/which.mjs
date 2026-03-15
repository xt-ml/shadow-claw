import { SUPPORTED_COMMANDS } from "../shell.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function whichCommand({ args, ok, fail }) {
  const target = args.filter((a) => !a.startsWith("-"))[0] ?? "";

  if (SUPPORTED_COMMANDS.has(target)) {
    return { result: ok(`/usr/bin/${target}\n`) };
  }

  return { result: fail(`which: ${target}: not found`) };
}
