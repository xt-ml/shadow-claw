/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function falseCommand({ fail }) {
  return { result: fail("", 1) };
}
