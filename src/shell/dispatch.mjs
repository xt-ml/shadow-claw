import { COMMAND_HANDLERS } from "./commands/registry.mjs";

/**
 * @typedef {import("./shell.mjs").ShellContext} ShellContext
 * @typedef {import("./shell.mjs").ShellResult} ShellResult
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("./commands/types.mjs").CommandContext} CommandContext
 */

/**
 * Dispatch command to handler
 *
 * @param {ShadowClawDatabase} db
 * @param {string} name
 * @param {string[]} args
 * @param {ShellContext} ctx
 * @param {string} stdin
 *
 * @returns {Promise<ShellResult>}
 */
export async function dispatch(db, name, args, ctx, stdin) {
  /** @param {string} stdout */
  const ok = (stdout) => ({
    stdout,
    stderr: "",
    exitCode: 0,
  });

  /**
   * @param {string} stderr
   * @param {number} [code=1]
   */
  const fail = (stderr, code = 1) => ({
    stdout: "",
    stderr: stderr,
    exitCode: code,
  });

  const handler = COMMAND_HANDLERS[name];
  if (!handler) {
    const available = Object.keys(COMMAND_HANDLERS).sort((left, right) =>
      left.localeCompare(right),
    );

    return fail(
      `${name}: command not found. Available: ${available.join(", ")}. ` +
        `For complex logic, use the "javascript" tool instead.`,
      127,
    );
  }

  /** @type {CommandContext} */
  const input = {
    db,
    args: [...args],
    ctx: {
      ...ctx,
      env: Object.freeze({ ...ctx.env }),
    },
    stdin,
    ok,
    fail,
  };

  const { result, nextCtx } = await handler(input);

  if (nextCtx?.env) {
    ctx.env = nextCtx.env;
  }

  if (nextCtx?.cwd) {
    ctx.cwd = nextCtx.cwd;
  }

  return result;
}
