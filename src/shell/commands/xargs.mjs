import { runSingle } from "../runSingle.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function xargsCommand({ db, args, ctx, stdin, ok, fail }) {
  let inputFile = null;
  let maxArgs = null;
  let index = 0;

  while (index < args.length) {
    const arg = args[index];

    if (arg === "-a") {
      const next = args[index + 1];
      if (next !== undefined) {
        inputFile = next;
        index += 2;

        continue;
      }

      break;
    }

    if (arg === "-n") {
      const next = args[index + 1];
      if (next !== undefined) {
        maxArgs = parseInt(next, 10);
        index += 2;

        continue;
      }

      break;
    }

    if (/^-n\d+$/u.test(arg)) {
      maxArgs = parseInt(arg.slice(2), 10);
      index += 1;

      continue;
    }

    break;
  }

  if (maxArgs !== null && (!Number.isFinite(maxArgs) || maxArgs < 1)) {
    return { result: fail("xargs: value 0 for -n option should be >= 1") };
  }

  const commandArgs = args.slice(index);
  const rawInput = inputFile
    ? ((await safeRead(db, ctx.groupId, resolvePath(inputFile, ctx))) ?? "")
    : stdin;

  const items = rawInput.trim().split(/\s+/u).filter(Boolean);

  if (commandArgs.length === 0) {
    if (maxArgs === null) {
      return { result: ok(items.length > 0 ? `${items.join(" ")}\n` : "") };
    }

    const chunks = [];
    for (let i = 0; i < items.length; i += maxArgs) {
      chunks.push(items.slice(i, i + maxArgs).join(" "));
    }

    return {
      result: ok(chunks.length > 0 ? `${chunks.join("\n")}\n` : ""),
    };
  }

  if (maxArgs === null) {
    const cmd =
      commandArgs.join(" ") + (items.length > 0 ? ` ${items.join(" ")}` : "");
    return { result: await runSingle(db, cmd, ctx, stdin) };
  }

  if (items.length === 0) {
    return { result: await runSingle(db, commandArgs.join(" "), ctx, stdin) };
  }

  let stdout = "";
  let stderr = "";

  for (let i = 0; i < items.length; i += maxArgs) {
    const chunk = items.slice(i, i + maxArgs).join(" ");
    const cmd = `${commandArgs.join(" ")} ${chunk}`;
    const result = await runSingle(db, cmd, ctx, stdin);

    stdout += result.stdout;
    stderr += result.stderr;

    if (result.exitCode !== 0) {
      return { result: { stdout, stderr, exitCode: result.exitCode } };
    }
  }

  return { result: { stdout, stderr, exitCode: 0 } };
}
