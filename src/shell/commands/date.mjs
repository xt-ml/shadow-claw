/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function dateCommand({ ok }) {
  return { result: ok(new Date().toISOString() + "\n") };
}
