import { testExpr } from "../testExpr.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function testCommand({ db, args, ctx }) {
  return {
    result: await testExpr(db, args, ctx),
  };
}
