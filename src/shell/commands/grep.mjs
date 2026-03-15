import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/**
 * Escape a string for use as a literal in a RegExp.
 *
 * @param {string} s
 *
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @type {ShellCommandHandler} */
export async function grepCommand({ db, args, ctx, stdin, ok, fail }) {
  // Pre-collect multiple -e patterns before general flag parsing.
  // Each "-e <pattern>" pair is extracted; the remaining args go to parseFlags.
  const ePatterns = [];
  const filteredArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-e" && i + 1 < args.length) {
      ePatterns.push(args[++i]);
    } else {
      filteredArgs.push(args[i]);
    }
  }

  const { flags, operands } = parseFlags(
    filteredArgs,
    ["m", "A", "B", "C", "e"],
    ["i", "v", "c", "n", "l", "L", "q", "E", "F", "o", "w", "x", "H", "h"],
  );

  // Also pick up any -e that survived (e.g., combined flags like -ve pattern)
  if (flags.e !== undefined) ePatterns.push(flags.e);

  const patternStrings =
    ePatterns.length > 0 ? ePatterns : [operands.shift() ?? ""];

  const fixedString = flags.F !== undefined;
  const caseInsensitive = flags.i !== undefined;
  const invertMatch = flags.v !== undefined;
  const onlyMatching = flags.o !== undefined;
  const wordRegexp = flags.w !== undefined;
  const lineRegexp = flags.x !== undefined;
  const showLineNumbers = flags.n !== undefined;
  const countMode = flags.c !== undefined;
  const quietMode = flags.q !== undefined;
  const listWithMatch = flags.l !== undefined;
  const listWithoutMatch = flags.L !== undefined;
  const withFilename = flags.H !== undefined;
  const noFilename = flags.h !== undefined;

  const maxCount =
    flags.m !== undefined ? parseInt(flags.m, 10) : Number.POSITIVE_INFINITY;
  const C = flags.C !== undefined ? parseInt(flags.C, 10) : 0;
  const afterContext = flags.A !== undefined ? parseInt(flags.A, 10) : C;
  const beforeContext = flags.B !== undefined ? parseInt(flags.B, 10) : C;
  const contextMode =
    flags.A !== undefined || flags.B !== undefined || flags.C !== undefined;

  // Build a combined regex from all pattern strings.
  const reParts = patternStrings.map((pat) => {
    let p = fixedString ? escapeRegex(pat) : pat;
    if (wordRegexp) p = `\\b(?:${p})\\b`;
    if (lineRegexp) p = `^(?:${p})$`;
    return `(?:${p})`;
  });
  const reFlags = caseInsensitive ? "gi" : "g";
  const re = new RegExp(reParts.join("|"), reFlags);

  /** @type {Array<{name: string; text: string}>} */
  const sources = [];

  if (operands.length === 0) {
    sources.push({ name: "-", text: stdin });
  } else {
    for (const operand of operands) {
      if (operand === "-") {
        sources.push({ name: "-", text: stdin });

        continue;
      }
      const content = await safeRead(
        db,
        ctx.groupId,
        resolvePath(operand, ctx),
      );
      if (content === null) continue;
      sources.push({ name: operand, text: content });
    }
  }

  // Show filename prefix when: -H is set, or multiple sources and neither
  // -h, -c, -l, nor -L suppress it.
  const showFilename =
    withFilename ||
    (sources.length > 1 &&
      !noFilename &&
      !countMode &&
      !listWithMatch &&
      !listWithoutMatch);

  const lineOutputs = [];
  const listedWithMatch = [];
  const listedWithoutMatch = [];
  let totalMatches = 0;

  for (const source of sources) {
    const raw = source.text.split("\n");
    // A trailing newline produces a spurious empty final element — strip it.
    const lines =
      raw.length > 0 && raw[raw.length - 1] === "" ? raw.slice(0, -1) : raw;

    /** @type {number[]} 0-based indices of lines that match (after invert) */
    const matchIndices = [];

    for (let idx = 0; idx < lines.length; idx++) {
      re.lastIndex = 0;
      const matched = re.test(lines[idx]);
      if (invertMatch ? !matched : matched) {
        matchIndices.push(idx);
        if (matchIndices.length >= maxCount) break;
      }
    }

    if (matchIndices.length > 0) {
      totalMatches += matchIndices.length;
      if (quietMode) return { result: ok("") };
      if (listWithMatch) {
        listedWithMatch.push(source.name);

        continue;
      }
    } else if (listWithoutMatch) {
      listedWithoutMatch.push(source.name);

      continue;
    } else if (listWithMatch) {
      continue;
    }

    if (countMode) continue;

    const prefix = showFilename ? `${source.name}:` : "";

    if (contextMode) {
      // Merge match indices into context ranges and emit with "--" separators.
      /** @type {Array<{start: number; end: number}>} */
      const ranges = [];
      for (const mi of matchIndices) {
        const start = Math.max(0, mi - beforeContext);
        const end = Math.min(lines.length - 1, mi + afterContext);
        if (ranges.length > 0 && start <= ranges[ranges.length - 1].end + 1) {
          ranges[ranges.length - 1].end = Math.max(
            ranges[ranges.length - 1].end,
            end,
          );
        } else {
          ranges.push({ start, end });
        }
      }
      let isFirst = true;
      for (const range of ranges) {
        if (!isFirst) lineOutputs.push("--");
        isFirst = false;
        for (let k = range.start; k <= range.end; k++) {
          const lineNumStr = showLineNumbers ? `${k + 1}:` : "";
          lineOutputs.push(`${prefix}${lineNumStr}${lines[k]}`);
        }
      }
    } else if (onlyMatching) {
      // Print only the matched portion(s) of each matching line.
      for (const mi of matchIndices) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(lines[mi])) !== null) {
          if (m[0] === "") {
            re.lastIndex++;
            continue;
          }
          const lineNumStr = showLineNumbers ? `${mi + 1}:` : "";
          lineOutputs.push(`${prefix}${lineNumStr}${m[0]}`);
        }
      }
    } else {
      for (const mi of matchIndices) {
        const lineNumStr = showLineNumbers ? `${mi + 1}:` : "";
        lineOutputs.push(`${prefix}${lineNumStr}${lines[mi]}`);
      }
    }
  }

  if (listWithMatch) {
    return listedWithMatch.length > 0
      ? { result: ok(listedWithMatch.join("\n") + "\n") }
      : { result: fail("", 1) };
  }

  if (listWithoutMatch) {
    return listedWithoutMatch.length > 0
      ? { result: ok(listedWithoutMatch.join("\n") + "\n") }
      : { result: fail("", 1) };
  }

  if (countMode) {
    return totalMatches > 0
      ? { result: ok(String(totalMatches) + "\n") }
      : { result: fail("", 1) };
  }

  return {
    result:
      lineOutputs.length > 0 ? ok(lineOutputs.join("\n") + "\n") : fail("", 1),
  };
}
