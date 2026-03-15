import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */
/** @typedef {"l" | "w" | "c" | "m" | "L"} WcMetric */
/** @typedef {Record<WcMetric, number>} WcStats */

/** @type {ShellCommandHandler} */
export async function wcCommand({ db, args, ctx, stdin, ok }) {
  const { flags, operands } = parseFlags(args, [], ["c", "l", "w", "L", "m"]);
  /** @type {WcMetric[]} */
  const selected = [];

  if (flags.l !== undefined) {
    selected.push("l");
  }

  if (flags.w !== undefined) {
    selected.push("w");
  }

  if (flags.c !== undefined) {
    selected.push("c");
  }

  if (flags.m !== undefined) {
    selected.push("m");
  }

  if (flags.L !== undefined) {
    selected.push("L");
  }

  /** @type {WcMetric[]} */
  const effectiveSelected = selected.length > 0 ? selected : ["l", "w", "c"];

  /** @type {Array<{name: string; text: string}>} */
  const sources = [];

  if (operands.length === 0) {
    sources.push({ name: "", text: stdin });
  } else {
    for (const operand of operands) {
      if (operand === "-") {
        sources.push({ name: "-", text: stdin });

        continue;
      }

      const text = await safeRead(db, ctx.groupId, resolvePath(operand, ctx));
      sources.push({ name: operand, text: text ?? "" });
    }
  }

  /** @param {string} text */
  const countStats = (text) => {
    const lineCount = (text.match(/\n/gu) ?? []).length;
    const wordCount = text.split(/\s+/u).filter(Boolean).length;
    const charCount = text.length;
    const maxLineLength = Math.max(
      0,
      ...text.split("\n").map((line) => line.length),
    );

    return /** @type {WcStats} */ ({
      l: lineCount,
      w: wordCount,
      c: charCount,
      m: charCount,
      L: maxLineLength,
    });
  };

  const rows = [];
  const totals = { l: 0, w: 0, c: 0, m: 0, L: 0 };

  for (const source of sources) {
    const stats = countStats(source.text);
    totals.l += stats.l;
    totals.w += stats.w;
    totals.c += stats.c;
    totals.m += stats.m;
    totals.L = Math.max(totals.L, stats.L);

    rows.push({ name: source.name, stats });
  }

  /**
   * @param {WcStats} stats
   * @param {string} name
   */
  const formatRow = (stats, name) => {
    const parts = effectiveSelected.map((key) => String(stats[key]));
    if (name) {
      return `${parts.join(" ")} ${name}`;
    }

    return parts.join(" ");
  };

  const lines = rows.map((row) => formatRow(row.stats, row.name));
  if (rows.length > 1) {
    lines.push(formatRow(totals, "total"));
  }

  return { result: ok(`${lines.join("\n")}\n`) };
}
