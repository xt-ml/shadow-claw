import { envCommand } from "./env.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function printenvCommand(input) {
  return envCommand({
    ...input,
    args: input.args ?? [],
  });
}
