/**
 * @typedef {import("../shell.mjs").ShellContext} ShellContext
 * @typedef {import("../shell.mjs").ShellResult} ShellResult
 * @typedef {import("../../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * @typedef {(stdout: string) => ShellResult} OkFn
 * @typedef {(stderr: string, code?: number) => ShellResult} FailFn
 */

/**
 * @typedef {Object} CommandContext
 * @property {ShadowClawDatabase} db
 * @property {string[]} args
 * @property {ShellContext} ctx
 * @property {string} stdin
 * @property {OkFn} ok
 * @property {FailFn} fail
 */

/**
 * @typedef {Object} CommandOutput
 * @property {ShellResult} result
 * @property {{ cwd?: string; env?: Record<string, string> }} [nextCtx]
 */

/** @typedef {(input: CommandContext) => Promise<CommandOutput>} ShellCommandHandler */
