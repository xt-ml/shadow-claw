/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function exportCommand({ args, ctx, ok }) {
  const nextEnv = { ...ctx.env };

  for (const a of args) {
    const eq = a.indexOf("=");
    if (eq > 0) {
      nextEnv[a.slice(0, eq)] = a.slice(eq + 1);
    }
  }

  return {
    result: ok(""),
    nextCtx: { env: nextEnv },
  };
}
