import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

// ---------------------------------------------------------------------------
// awk: pattern-action text processor
// Supports: {print}, {printf}, patterns (/re/, !/re/, NR==N), BEGIN/END, -F
// ---------------------------------------------------------------------------

/**
 * Split a string on top-level commas (not inside quoted strings).
 *
 * @param {string} str
 *
 * @returns {string[]}
 */
function splitOnTopLevelComma(str) {
  const parts = [];
  let cur = "";
  let inStr = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === "\\" && i + 1 < str.length) {
        cur += ch + str[++i];

        continue;
      }

      if (ch === '"') inStr = false;
      cur += ch;

      continue;
    }

    if (ch === '"') {
      inStr = true;
      cur += ch;

      continue;
    }

    if (ch === ",") {
      parts.push(cur.trim());
      cur = "";

      continue;
    }
    cur += ch;
  }

  if (cur.trim()) {
    parts.push(cur.trim());
  }

  return parts;
}

/**
 * Evaluate an awk expression token to a string value.
 * Handles: $N, NR, NF, quoted string literals, and raw substitution.
 *
 * @param {string} expr
 * @param {string[]} fields
 * @param {string} line
 * @param {number} nr
 * @param {number} nf
 *
 * @returns {string}
 */
function evalAwkExprStr(expr, fields, line, nr, nf) {
  expr = expr.trim();
  // Quoted string literal: strip quotes and expand escape sequences
  if (expr.startsWith('"') && expr.endsWith('"')) {
    return expr
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }
  // Field and variable substitution
  return expr
    .replace(/\$(\d+)/g, (_, n) => {
      const idx = parseInt(n, 10);
      return idx === 0 ? line : (fields[idx - 1] ?? "");
    })
    .replace(/\bNF\b/g, String(nf))
    .replace(/\bNR\b/g, String(nr));
}

/**
 * Simple sprintf supporting %s, %d, %f.
 *
 * @param {string} fmt  (may already have real newlines from evalAwkExprStr)
 * @param {string[]} args
 *
 * @returns {string}
 */
function sprintfSimple(fmt, args) {
  let i = 0;
  return fmt
    .replace(/%s/g, () => String(args[i++] ?? ""))
    .replace(/%d/g, () => String(Math.floor(Number(args[i++] ?? 0))))
    .replace(/%f/g, () => String(Number(args[i++] ?? 0)));
}

/**
 * Find the index of the matching `}` for the opening `{` at str[0].
 * Returns -1 if not found.
 *
 * @param {string} str
 *
 * @returns {number}
 */
function findClosingBrace(str) {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === "\\" && i + 1 < str.length) {
        i++;

        continue;
      }

      if (ch === '"') inStr = false;

      continue;
    }

    if (ch === '"') {
      inStr = true;

      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * @typedef {{ pattern: "BEGIN" | "END" | null | object; body: string }} AwkRule
 */

/**
 * Parse an awk program string into an array of rules.
 *
 * @param {string} program
 *
 * @returns {AwkRule[]}
 */
function parseAwkRules(program) {
  /** @type {AwkRule[]} */
  const rules = [];
  let rest = program.trim();

  while (rest.length > 0) {
    rest = rest.trim();
    if (rest.length === 0) break;

    /** @type {AwkRule["pattern"]} */
    let pattern = null;

    if (/^BEGIN[\s{]/.test(rest)) {
      pattern = "BEGIN";
      rest = rest.slice(5).trim();
    } else if (/^END[\s{]/.test(rest)) {
      pattern = "END";
      rest = rest.slice(3).trim();
    } else if (rest.startsWith("!/")) {
      const m = rest.match(/^!\/([^/]*)\/(.*)$/s);
      if (m) {
        pattern = { type: "regex", re: new RegExp(m[1]), negate: true };
        rest = m[2].trim();
      }
    } else if (rest.startsWith("/")) {
      const m = rest.match(/^\/([^/]*)\/(.*)$/s);
      if (m) {
        pattern = { type: "regex", re: new RegExp(m[1]), negate: false };
        rest = m[2].trim();
      }
    } else if (/^NR\s*==\s*\d+/.test(rest)) {
      const m = rest.match(/^NR\s*==\s*(\d+)(.*)/s);
      if (m) {
        pattern = { type: "nr_eq", n: parseInt(m[1], 10) };
        rest = m[2].trim();
      }
    }

    rest = rest.trim();
    if (!rest.startsWith("{")) break; // malformed

    const closeIdx = findClosingBrace(rest);
    if (closeIdx === -1) break;

    const body = rest.slice(1, closeIdx).trim();
    rest = rest.slice(closeIdx + 1).trim();
    rules.push({ pattern, body });
  }

  return rules;
}

/**
 * Execute the statements in an action body for one record.
 * Returns the output string, or null if an unsupported statement is detected.
 *
 * @param {string} body
 * @param {string[]} fields
 * @param {string} line
 * @param {number} nr
 * @param {number} nf
 * @param {string} ofs
 *
 * @returns {{ out: string; error: string | null }}
 */
function processAction(body, fields, line, nr, nf, ofs) {
  const stmts = body
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let out = "";

  for (const stmt of stmts) {
    if (stmt === "print") {
      out += line + "\n";
    } else if (/^print[\s(]/.test(stmt)) {
      const argStr = stmt.slice(5).trim();
      const parts = splitOnTopLevelComma(argStr);
      if (parts.length > 1) {
        const values = parts.map((p) =>
          evalAwkExprStr(p, fields, line, nr, nf),
        );
        out += values.join(ofs) + "\n";
      } else {
        out += evalAwkExprStr(argStr, fields, line, nr, nf) + "\n";
      }
    } else if (/^printf[\s(]/.test(stmt)) {
      const argStr = stmt.slice(6).trim();
      const parts = splitOnTopLevelComma(argStr);
      const fmt = evalAwkExprStr(parts[0] ?? '""', fields, line, nr, nf);
      const fmtArgs = parts
        .slice(1)
        .map((p) => evalAwkExprStr(p, fields, line, nr, nf));
      out += sprintfSimple(fmt, fmtArgs);
    } else {
      return { out: "", error: stmt };
    }
  }

  return { out, error: null };
}

/** @type {ShellCommandHandler} */
export async function awkCommand({ db, args, ctx, stdin, ok, fail }) {
  /** @type {string | null} */
  let fieldSep = null;
  /** @type {string[]} */
  const positional = [];

  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "-F" && i + 1 < args.length) {
      fieldSep = args[++i];
      i++;

      continue;
    }

    if (a.startsWith("-F")) {
      fieldSep = a.slice(2);
      i++;

      continue;
    }
    positional.push(a);
    i++;
  }

  const program = positional[0] ?? "";
  const fileArg = positional[1] ?? null;

  const text = fileArg
    ? ((await safeRead(db, ctx.groupId, resolvePath(fileArg, ctx))) ?? "")
    : stdin;

  const rules = parseAwkRules(program);
  const ofs = " ";

  // Validate all rules upfront — catch unsupported statements early
  for (const rule of rules) {
    const { error } = processAction(rule.body, [], "", 0, 0, ofs);
    if (error !== null)
      return {
        result: fail("awk: only basic {print $N} patterns supported"),
      };
  }

  const lines = text.split("\n").filter(Boolean);
  let totalNr = 0;
  let output = "";

  // BEGIN rules
  for (const rule of rules) {
    if (rule.pattern === "BEGIN") {
      const { out } = processAction(rule.body, [], "", 0, 0, ofs);
      output += out;
    }
  }

  // Main processing
  for (const line of lines) {
    totalNr++;
    const fields = fieldSep ? line.split(fieldSep) : line.trim().split(/\s+/);
    const nf = fields.length;
    const nr = totalNr;

    for (const rule of rules) {
      if (rule.pattern === "BEGIN" || rule.pattern === "END") continue;

      // Check pattern match
      let matches = true;
      if (rule.pattern !== null) {
        const p = /** @type {any} */ (rule.pattern);
        if (p.type === "regex") {
          matches = p.re.test(line) !== p.negate;
        } else if (p.type === "nr_eq") {
          matches = nr === p.n;
        }
      }

      if (!matches) continue;

      const { out } = processAction(rule.body, fields, line, nr, nf, ofs);
      output += out;
    }
  }

  // END rules
  for (const rule of rules) {
    if (rule.pattern === "END") {
      const { out } = processAction(rule.body, [], "", totalNr, 0, ofs);
      output += out;
    }
  }

  return { result: ok(output) };
}
