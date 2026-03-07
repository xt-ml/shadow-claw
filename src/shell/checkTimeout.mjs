/** @typedef {import("./shell.mjs").ShellContext} ShellContext */

/**
 * Check timeout
 *
 * @param {ShellContext} ctx
 */
export function checkTimeout(ctx) {
  if (Date.now() - ctx.startedAt > ctx.timeoutMs) {
    throw new Error("[command timed out]");
  }
}
