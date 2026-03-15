/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function pwdCommand({ args = [], ctx, ok }) {
  const normalized = args.filter((arg) => arg !== "-P");
  if (normalized.length > 0) {
    return { result: ok("/workspace\n") };
  }

  return {
    result: ok(
      (ctx.cwd === "." ? "/workspace" : `/workspace/${ctx.cwd}`) + "\n",
    ),
  };
}
