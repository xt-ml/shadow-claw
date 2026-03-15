import { listGroupFiles } from "../../storage/listGroupFiles.mjs";
import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {ShellCommandHandler} */
export async function lsCommand({ db, args, ctx, ok, fail }) {
  const { flags, operands } = parseFlags(args, [], ["l", "a", "1", "C", "x"]);
  const target = operands[0] || ".";

  try {
    const entries = await listGroupFiles(
      db,
      ctx.groupId,
      resolvePath(".", ctx),
    );

    let filtered = entries;
    if (flags.a === undefined) {
      filtered = entries.filter((e) => !e.startsWith("."));
    }

    // Toybox treats explicit patterns like file* as explicit file operands.
    if (operands.length > 0 && target !== "." && target !== "./") {
      const patterns = operands;
      const picked = [];

      for (const pattern of patterns) {
        if (pattern.includes("*")) {
          const regex = new RegExp(
            `^${pattern.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, ".*")}$`,
          );

          for (const name of filtered) {
            if (regex.test(name)) {
              picked.push(name);
            }
          }

          continue;
        }

        if (filtered.includes(pattern)) {
          picked.push(pattern);
        } else {
          return {
            result: fail(`ls: cannot access '${pattern}': No such directory`),
          };
        }
      }

      return {
        result: ok(picked.join("\n") + (picked.length > 0 ? "\n" : "")),
      };
    }

    if (flags["1"] !== undefined || flags.l !== undefined) {
      return { result: ok(filtered.join("\n") + "\n") };
    }

    return { result: ok(filtered.join("  ") + "\n") };
  } catch {
    return { result: fail(`ls: cannot access '${target}': No such directory`) };
  }
}
