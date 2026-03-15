import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/**
 * @param {string} spec
 *
 * @returns {{ indexes: number[]; error: string | null }}
 */
function parseSelectionSpec(spec) {
  const selected = new Set();

  for (const rawToken of spec.split(",")) {
    const token = rawToken.trim();
    if (!token) {
      continue;
    }

    const range = token.match(/^(\d+)-(\d+)$/u);
    if (range) {
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);
      if (start > end) {
        return { indexes: [], error: "cut: invalid decreasing range" };
      }

      for (let value = start; value <= end; value += 1) {
        selected.add(value - 1);
      }

      continue;
    }

    const single = token.match(/^\d+$/u);
    if (single) {
      selected.add(Number.parseInt(token, 10) - 1);

      continue;
    }
  }

  return {
    indexes: [...selected].sort((left, right) => left - right),
    error: null,
  };
}

/**
 * @param {string} line
 * @param {number[]} indexes
 */
function selectCharacters(line, indexes) {
  return indexes
    .map((index) => (index >= 0 && index < line.length ? line[index] : ""))
    .join("");
}

/** @type {ShellCommandHandler} */
export async function cutCommand({ db, args, ctx, stdin, ok, fail }) {
  const { flags, operands } = parseFlags(args, ["d", "f", "b", "c"], ["s"]);
  const mode = flags.b !== undefined ? "b" : flags.c !== undefined ? "c" : "f";
  const selectionSpec =
    mode === "b" ? flags.b : mode === "c" ? flags.c : (flags.f ?? "1");

  const { indexes, error } = parseSelectionSpec(selectionSpec);
  if (error) {
    return { result: fail(error) };
  }

  const delim = flags.d ?? "\t";

  const text =
    operands.length > 0
      ? ((await safeRead(db, ctx.groupId, resolvePath(operands[0], ctx))) ?? "")
      : stdin;

  const result = text.split("\n").map((line) => {
    if (mode === "b" || mode === "c") {
      return selectCharacters(line, indexes);
    }

    const parts = line.split(delim);
    return indexes.map((index) => parts[index] ?? "").join(delim);
  });

  return { result: ok(result.join("\n")) };
}
