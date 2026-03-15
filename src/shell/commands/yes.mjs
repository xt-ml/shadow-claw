/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function yesCommand({ args, ok }) {
  const word = args[0] ?? "y";
  return { result: ok(Array(100).fill(word).join("\n") + "\n") };
}
