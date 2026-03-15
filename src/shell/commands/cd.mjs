import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function cdCommand({ args, ctx, ok }) {
  const target = args[0] ?? ".";
  const nextCwd = resolvePath(target, ctx);

  return {
    result: ok(""),
    nextCtx: {
      cwd: nextCwd,
      env: {
        ...ctx.env,
        PWD: `/workspace/${nextCwd}`,
      },
    },
  };
}
