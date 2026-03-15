import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

// ---------------------------------------------------------------------------
// sed: line-by-line stream editor
// Supports: s///[gip], d, p, q, =, line/range/$//pattern/ addressing, -n, -e
// ---------------------------------------------------------------------------

/**
 * Split a sed script on semicolons at the top level (not inside s/// fields).
 *
 * @param {string} s
 *
 * @returns {string[]}
 */
function splitSedSemicolon(s) {
  const parts = [];

  let cur = "";
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    // Detect s command: 's' followed by a non-word, non-space delimiter
    if (ch === "s" && i + 1 < s.length && !/[\w\s]/.test(s[i + 1])) {
      const delim = s[i + 1];

      let j = i + 2;
      let count = 0;
      while (j < s.length && count < 2) {
        if (s[j] === "\\") {
          j += 2;
          continue;
        }

        if (s[j] === delim) {
          count++;
        }

        j++;
      }

      // consume flags (g, i, p and uppercase variants)
      while (j < s.length && /[gipGIP]/.test(s[j])) {
        j++;
      }

      cur += s.slice(i, j);
      i = j;

      continue;
    }

    if (ch === ";") {
      if (cur.trim()) {
        parts.push(cur.trim());
      }

      cur = "";
    } else {
      cur += ch;
    }

    i++;
  }

  if (cur.trim()) {
    parts.push(cur.trim());
  }

  return parts;
}

/**
 * @typedef {{ type: string; addr: object | null; negate: boolean;
 *   pattern?: string; replacement?: string; flags?: string; raw?: string }} SedCmd
 */

/**
 * Parse a single sed command (possibly prefixed with an address).
 *
 * @param {string} raw
 *
 * @returns {SedCmd}
 */
function parseSingleCmd(raw) {
  const orig = raw;
  raw = raw.trim();

  /** @type {object | null} */
  let addr = null;

  // $ last-line address
  if (raw.startsWith("$")) {
    addr = { type: "last" };
    raw = raw.slice(1).trim();
  }

  // /pattern/ address
  if (!addr) {
    const m = raw.match(/^\/([^/]*)\/(.*)$/s);
    if (m) {
      addr = { type: "pattern", re: new RegExp(m[1]) };
      raw = m[2].trim();
    }
  }

  // N,M or N,$ range
  if (!addr) {
    const m = raw.match(/^(\d+),((\d+)|\$)(.*)$/s);
    if (m) {
      addr = {
        type: "range",
        start: Number(m[1]),
        end: m[3] !== undefined ? Number(m[3]) : Infinity,
      };

      raw = m[4].trim();
    }
  }

  // N single-line address
  if (!addr) {
    const m = raw.match(/^(\d+)(.*)$/s);
    if (m) {
      addr = { type: "line", n: Number(m[1]) };

      raw = m[2].trim();
    }
  }

  // s command
  const sMatch = raw.match(/^s(.)(.+?)\1(.*?)\1([gipGIP]*)$/);
  if (sMatch) {
    return {
      type: "s",
      addr,
      negate: false,
      pattern: sMatch[2],
      replacement: sMatch[3],
      flags: sMatch[4],
    };
  }

  if (raw === "d") {
    return { type: "d", addr, negate: false };
  }

  if (raw === "p") {
    return { type: "p", addr, negate: false };
  }

  if (raw === "q") {
    return { type: "q", addr, negate: false };
  }

  if (raw === "=") {
    return { type: "=", addr, negate: false };
  }

  return { type: "error", addr: null, negate: false, raw: orig };
}

/**
 * Check if a command's address matches the current line context.
 *
 * @param {object | null} addr
 * @param {boolean} negate
 * @param {number} lineNum  1-based
 * @param {number} total    total line count
 * @param {string} line     current line text
 *
 * @returns {boolean}
 */
function matchesAddress(addr, negate, lineNum, total, line) {
  if (!addr) {
    return !negate;
  }

  const a = /** @type {any} */ (addr);
  let match = false;
  if (a.type === "line") {
    match = lineNum === a.n;
  } else if (a.type === "range") {
    match = lineNum >= a.start && lineNum <= a.end;
  } else if (a.type === "last") {
    match = lineNum === total;
  } else if (a.type === "pattern") {
    match = a.re.test(line);
  }

  return negate ? !match : match;
}

/** @type {ShellCommandHandler} */
export async function sedCommand({ db, args, ctx, stdin, ok, fail }) {
  let silentMode = false;

  /** @type {string[]} */
  const expressions = [];
  let fileArg = /** @type {string | null} */ (null);

  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "-n") {
      silentMode = true;
      i++;

      continue;
    }

    if (a === "-e") {
      if (i + 1 < args.length) expressions.push(args[++i]);
      i++;

      continue;
    }

    if (a.startsWith("-e")) {
      expressions.push(a.slice(2));
      i++;

      continue;
    }

    if (!a.startsWith("-")) {
      if (expressions.length === 0) expressions.push(a);
      else fileArg = a;
    }
    i++;
  }

  if (expressions.length === 0)
    return { result: fail("sed: no expression specified") };

  const text = fileArg
    ? ((await safeRead(db, ctx.groupId, resolvePath(fileArg, ctx))) ?? "")
    : stdin;

  // Parse all expressions into command objects
  /** @type {SedCmd[]} */
  const cmds = [];
  for (const expr of expressions) {
    cmds.push(...splitSedSemicolon(expr).map(parseSingleCmd));
  }

  // Check for unsupported commands
  const badCmd = cmds.find((c) => c.type === "error");
  if (badCmd) {
    return {
      result: fail(
        `sed: unsupported expression: ${badCmd.raw ?? expressions[0]}`,
      ),
    };
  }

  // Split input into lines, preserving trailing-newline behaviour
  const endsWithNewline = text.endsWith("\n");
  const rawLines = text.split("\n");
  const lines = endsWithNewline ? rawLines.slice(0, -1) : rawLines;
  const totalLines = lines.length;

  /** @type {string[]} */
  const output = [];
  let quit = false;

  for (let lineIdx = 0; lineIdx < totalLines && !quit; lineIdx++) {
    const lineNum = lineIdx + 1;

    let line = lines[lineIdx];
    let deleted = false;

    /** @type {string[]} */
    const extraPrints = [];

    for (const cmd of cmds) {
      if (deleted) {
        break;
      }

      if (
        !matchesAddress(cmd.addr ?? null, cmd.negate, lineNum, totalLines, line)
      ) {
        continue;
      }

      switch (cmd.type) {
        case "s": {
          // Mirror original flag logic: presence of 'i' implies global+case-insensitive
          const flags = cmd.flags ?? "";
          const jsFlags = flags.toLowerCase().includes("i")
            ? "gi"
            : flags.toLowerCase().includes("g")
              ? "g"
              : "";

          const testRe = new RegExp(
            /** @type {string} */ (cmd.pattern),
            flags.toLowerCase().includes("i") ? "i" : "",
          );

          const matched = testRe.test(line);
          const re = new RegExp(/** @type {string} */ (cmd.pattern), jsFlags);

          line = line.replace(re, /** @type {string} */ (cmd.replacement));
          if (flags.toLowerCase().includes("p") && matched) {
            extraPrints.push(line);
          }

          break;
        }

        case "d":
          deleted = true;
          break;
        case "q":
          quit = true;
          break;
        case "=":
          output.push(String(lineNum));
          break;
        case "p":
          output.push(line);
          break;
      }
    }

    if (!deleted) {
      if (!silentMode) {
        output.push(line);
      }

      output.push(...extraPrints);
    }
  }

  if (output.length === 0) {
    return { result: ok("") };
  }

  return { result: ok(output.join("\n") + (endsWithNewline ? "\n" : "")) };
}
