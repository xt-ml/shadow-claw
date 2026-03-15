import { testExpr } from "../testExpr.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function bracketCommand({ db, args, ctx }) {
  return {
    result: await testExpr(db, args.slice(0, -1), ctx),
  };
}
