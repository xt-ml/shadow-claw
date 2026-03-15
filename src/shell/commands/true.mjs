/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function trueCommand({ ok }) {
  return { result: ok("") };
}
