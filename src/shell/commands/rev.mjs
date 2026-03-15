import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function revCommand({ db, args, ctx, stdin, ok }) {
  const sources = args.length > 0 ? args : ["-"];
  const parts = [];

  for (const source of sources) {
    const text =
      source === "-"
        ? stdin
        : ((await safeRead(db, ctx.groupId, resolvePath(source, ctx))) ?? "");

    parts.push(
      text
        .split("\n")
        .map((line) => line.split("").reverse().join(""))
        .join("\n"),
    );
  }

  return {
    result: ok(parts.join("")),
  };
}
