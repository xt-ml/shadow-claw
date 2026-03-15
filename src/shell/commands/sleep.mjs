/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function sleepCommand({ args, ok }) {
  const ms = Math.min(parseFloat(args[0] ?? "0") * 1000, 5000);
  await new Promise((r) => setTimeout(r, ms));
  return { result: ok("") };
}
