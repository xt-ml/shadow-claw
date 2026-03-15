/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function echoCommand({ args, ok }) {
  let suppressNewline = false;
  let index = 0;

  // Match common echo behavior where one or more leading -n flags suppress \n.
  while (index < args.length && /^-n+$/.test(args[index])) {
    suppressNewline = true;
    index += 1;
  }

  const suffix = suppressNewline ? "" : "\n";
  return { result: ok(args.slice(index).join(" ") + suffix) };
}
