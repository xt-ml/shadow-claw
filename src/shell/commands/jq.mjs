import { resolvePath } from "../resolvePath.mjs";
import { safeRead } from "../safeRead.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

// ---------------------------------------------------------------------------
// Tiny jq expression evaluator
// ---------------------------------------------------------------------------
// Supports a useful subset of jq sufficient for agent tool use:
//   path traversal, iteration, slicing, piping, builtins, if/then/else,
//   arithmetic, comparison, logical operators, -r/-c/-n flags.
// ---------------------------------------------------------------------------

class JqError extends Error {}

/**
 * Evaluate a jq expression against a value.
 * Returns an array of output values (jq can produce multiple outputs).
 *
 * @param {string} expr
 * @param {unknown} input
 * @param {Record<string, unknown>} vars  named variables ($name)
 * @returns {unknown[]}
 */
function jqEval(expr, input, vars = {}) {
  expr = expr.trim();

  // --- pipe: split on top-level | ---
  {
    const parts = splitTopLevel(expr, "|");
    if (parts.length > 1) {
      let values = [input];
      for (const part of parts) {
        const next = [];
        for (const v of values) {
          // evalExpr handles IteratorSignal (.[] expansion) from path segments
          next.push(...evalExpr(part.trim(), v, vars));
        }
        values = next;
      }

      return values;
    }
  }

  // --- comma at top level (multiple expressions) ---
  {
    const parts = splitTopLevel(expr, ",");
    if (parts.length > 1) {
      const out = [];
      for (const p of parts) out.push(...evalExpr(p.trim(), input, vars));

      return out;
    }
  }

  // --- if/then/else/end ---
  {
    const m = matchIfThenElse(expr);
    if (m) {
      const cond = jqEval(m.cond, input, vars);
      const branch = isTruthy(cond[0]) ? m.then : m.else;

      return jqEval(branch, input, vars);
    }
  }

  // --- assignment update: .foo += expr, .foo -= expr, etc. ---
  {
    const m = expr.match(/^(.+?)\s*(\+|-|\*|\/|%)=\s*(.+)$/s);
    if (m && m[1].trim().startsWith(".") && !m[3].startsWith('"')) {
      const target = m[1].trim();
      const op = m[2];
      const rhs = jqEval(m[3].trim(), input, vars)[0];
      const current = jqEval(target, input, vars)[0];
      const newVal = applyArith(current, op, rhs);

      return [jqAssign(input, target, newVal)];
    }
  }

  // --- boolean: and / or ---
  if (/\band\b/.test(expr)) {
    const parts = splitTopLevel(expr, "and");
    if (parts.length === 2) {
      const l = jqEval(parts[0].trim(), input, vars)[0];
      const r = jqEval(parts[1].trim(), input, vars)[0];

      return [isTruthy(l) && isTruthy(r)];
    }
  }

  if (/\bor\b/.test(expr)) {
    const parts = splitTopLevel(expr, "or");
    if (parts.length === 2) {
      const l = jqEval(parts[0].trim(), input, vars)[0];
      const r = jqEval(parts[1].trim(), input, vars)[0];

      return [isTruthy(l) || isTruthy(r)];
    }
  }

  // --- comparisons ---
  for (const op of ["==", "!=", "<=", ">=", "<", ">"]) {
    const idx = topLevelIndexOf(expr, op);
    if (idx !== -1) {
      const l = jqEval(expr.slice(0, idx).trim(), input, vars)[0];
      const r = jqEval(expr.slice(idx + op.length).trim(), input, vars)[0];

      switch (op) {
        case "==":
          return [l === r || JSON.stringify(l) === JSON.stringify(r)];
        case "!=":
          return [l !== r && JSON.stringify(l) !== JSON.stringify(r)];
        case "<":
          return [/** @type {any} */ (l) < /** @type {any} */ (r)];
        case ">":
          return [/** @type {any} */ (l) > /** @type {any} */ (r)];
        case "<=":
          return [/** @type {any} */ (l) <= /** @type {any} */ (r)];
        case ">=":
          return [/** @type {any} */ (l) >= /** @type {any} */ (r)];
      }
    }
  }

  // --- // alternative operator ---
  {
    const idx = topLevelIndexOf(expr, "//");
    if (idx !== -1) {
      const l = jqEval(expr.slice(0, idx).trim(), input, vars)[0];
      if (l !== null && l !== false && l !== undefined) {
        return [l];
      }

      return jqEval(expr.slice(idx + 2).trim(), input, vars);
    }
  }

  // --- arithmetic at top level ---
  for (const op of ["+", "-", "*", "/", "%"]) {
    const idx = topLevelArithIndex(expr, op);
    if (idx !== -1) {
      const l = jqEval(expr.slice(0, idx).trim(), input, vars)[0];
      const r = jqEval(expr.slice(idx + 1).trim(), input, vars)[0];

      return [applyArith(l, op, r)];
    }
  }

  // --- not ---
  if (expr === "not") {
    return [!isTruthy(input)];
  }

  if (expr.endsWith(" | not")) {
    const val = jqEval(expr.slice(0, -6).trim(), input, vars)[0];

    return [!isTruthy(val)];
  }

  // --- literals ---
  if (expr === "true") {
    return [true];
  }

  if (expr === "false") {
    return [false];
  }

  if (expr === "null") {
    return [null];
  }

  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return [Number(expr)];
  }

  if (expr.startsWith('"') && expr.endsWith('"')) {
    return [JSON.parse(expr)];
  }

  // --- string interpolation \(.expr) ---
  if (expr.startsWith('"') || expr.includes("\\(")) {
    try {
      return [evalStringInterp(expr, input, vars)];
    } catch {
      /* fall through */
    }
  }

  // --- [expr] array collect: [.[] | select(...)], [.a, .b], [1,2,3] ---
  if (expr.startsWith("[") && expr.endsWith("]")) {
    const inner = expr.slice(1, -1).trim();
    const results = evalExpr(inner, input, vars);

    return [results];
  }

  // --- builtin functions ---
  const builtinResult = tryBuiltin(expr, input, vars);
  if (builtinResult !== undefined) {
    return builtinResult;
  }

  // --- identity ---
  if (expr === ".") {
    return [input];
  }

  // --- path expressions: .foo, .["foo"], .[N], .[], .[N:M], .foo.bar, .foo[] ---
  // evalPath returns a single value; IteratorSignal is thrown for .[] and caught by evalExpr
  return [evalPath(expr, input, vars)];
}

/**
 * @param {unknown} l
 * @param {string} op
 * @param {unknown} r
 *
 * @returns {unknown}
 */
function applyArith(l, op, r) {
  if (typeof l === "object" && l !== null && !Array.isArray(l) && op === "+") {
    return { .../** @type {object} */ (l), .../** @type {object} */ (r) };
  }

  if (Array.isArray(l) && op === "+") {
    return [...l, .../** @type {unknown[]}*/ (r)];
  }

  if (typeof l === "string" && op === "+") {
    return String(l) + String(r);
  }

  const ln = Number(l),
    rn = Number(r);

  switch (op) {
    case "+":
      return ln + rn;
    case "-":
      return ln - rn;
    case "*":
      return ln * rn;
    case "/":
      return ln / rn;
    case "%":
      return ln % rn;
  }

  return null;
}

/**
 * Attempt to match a builtin call.
 * Returns undefined if not a builtin.
 *
 * @param {string} expr
 * @param {unknown} input
 * @param {Record<string, unknown>} vars
 *
 * @returns {unknown[] | undefined}
 */
function tryBuiltin(expr, input, vars) {
  // map(expr)
  {
    const m = expr.match(/^map\((.+)\)$/s);
    if (m) {
      if (!Array.isArray(input)) {
        throw new JqError("map: not an array");
      }

      return [input.map((v) => jqEval(m[1], v, vars)[0])];
    }
  }

  // map_values(expr)
  {
    const m = expr.match(/^map_values\((.+)\)$/s);
    if (m) {
      if (Array.isArray(input)) {
        return [input.map((v) => jqEval(m[1], v, vars)[0])];
      }

      if (typeof input === "object" && input !== null) {
        const out = /** @type {Record<string, unknown>} */ ({});
        for (const [k, v] of Object.entries(input)) {
          out[k] = jqEval(m[1], v, vars)[0];
        }

        return [out];
      }
    }
  }

  // select(expr)
  {
    const m = expr.match(/^select\((.+)\)$/s);
    if (m) {
      const test = jqEval(m[1], input, vars)[0];

      return isTruthy(test) ? [input] : [];
    }
  }

  // sort_by(expr)
  {
    const m = expr.match(/^sort_by\((.+)\)$/s);
    if (m) {
      if (!Array.isArray(input)) {
        throw new JqError("sort_by: not an array");
      }

      return [
        [...input].sort((a, b) => {
          const ka = jqEval(m[1], a, vars)[0];
          const kb = jqEval(m[1], b, vars)[0];

          return /** @type {any} */ (ka) < /** @type {any} */ (kb)
            ? -1
            : /** @type {any} */ (ka) > /** @type {any} */ (kb)
              ? 1
              : 0;
        }),
      ];
    }
  }

  // min_by(expr) / max_by(expr)
  for (const fn of ["min_by", "max_by"]) {
    const m = expr.match(new RegExp(`^${fn}\\((.+)\\)$`, "s"));
    if (m) {
      if (!Array.isArray(input) || input.length === 0) {
        return [null];
      }

      const sorted = [...input].sort((a, b) => {
        const ka = jqEval(m[1], a, vars)[0];
        const kb = jqEval(m[1], b, vars)[0];

        return /** @type {any} */ (ka) < /** @type {any} */ (kb)
          ? -1
          : /** @type {any} */ (ka) > /** @type {any} */ (kb)
            ? 1
            : 0;
      });

      return [fn === "min_by" ? sorted[0] : sorted[sorted.length - 1]];
    }
  }

  // unique_by(expr)
  {
    const m = expr.match(/^unique_by\((.+)\)$/s);
    if (m) {
      if (!Array.isArray(input)) {
        throw new JqError("unique_by: not an array");
      }

      const seen = new Set();

      return [
        input.filter((v) => {
          const k = JSON.stringify(jqEval(m[1], v, vars)[0]);
          if (seen.has(k)) {
            return false;
          }

          seen.add(k);

          return true;
        }),
      ];
    }
  }

  // group_by(expr)
  {
    const m = expr.match(/^group_by\((.+)\)$/s);
    if (m) {
      if (!Array.isArray(input)) {
        throw new JqError("group_by: not an array");
      }

      /** @type {Map<string, unknown[]>} */
      const groups = new Map();
      const keys = [];
      for (const v of input) {
        const k = JSON.stringify(jqEval(m[1], v, vars)[0]);
        if (!groups.has(k)) {
          groups.set(k, []);
          keys.push(k);
        }

        groups.get(k)?.push(v);
      }

      keys.sort();

      return [[...keys.map((k) => groups.get(k))]];
    }
  }

  // has(key)
  {
    const m = expr.match(/^has\((.+)\)$/);
    if (m) {
      const key = jqEval(m[1], input, vars)[0];
      if (Array.isArray(input)) {
        return [typeof key === "number" && key >= 0 && key < input.length];
      }

      if (typeof input === "object" && input !== null) {
        if (
          typeof key === "string" ||
          typeof key === "number" ||
          typeof key === "symbol"
        ) {
          return [Object.prototype.hasOwnProperty.call(input, key)];
        }

        return [false];
      }

      return [false];
    }
  }

  // del(.path)
  {
    const m = expr.match(/^del\((.+)\)$/s);
    if (m) {
      const path = m[1].trim();

      return [jqDelete(input, path)];
    }
  }

  // to_entries
  if (expr === "to_entries") {
    if (typeof input === "object" && input !== null && !Array.isArray(input)) {
      return [Object.entries(input).map(([key, value]) => ({ key, value }))];
    }
  }

  // from_entries
  if (expr === "from_entries") {
    if (Array.isArray(input)) {
      const out = /** @type {Record<string, unknown>} */ ({});
      for (const e of input) {
        const entry = /** @type {any} */ (e);
        const k = entry.key ?? entry.name ?? entry.k;
        out[k] = entry.value ?? entry.v;
      }

      return [out];
    }
  }

  // with_entries(expr)
  {
    const m = expr.match(/^with_entries\((.+)\)$/s);
    if (m) {
      const entries = jqEval("to_entries", input, vars)[0];
      const mapped = jqEval(`map(${m[1]})`, entries, vars)[0];

      return jqEval("from_entries", mapped, vars);
    }
  }

  // flatten / flatten(N)
  {
    const m = expr.match(/^flatten(\((\d+)\))?$/);
    if (m) {
      const depth = m[2] !== undefined ? Number(m[2]) : Infinity;

      return [flattenDeep(input, depth)];
    }
  }

  // add
  if (expr === "add") {
    if (!Array.isArray(input)) {
      return [null];
    }

    if (input.length === 0) {
      return [null];
    }

    return [input.reduce((acc, v) => applyArith(acc, "+", v))];
  }

  // any(expr) / any
  {
    const m = expr.match(/^any\((.+)\)$/s);
    if (m) {
      if (!Array.isArray(input)) {
        throw new JqError("any: not an array");
      }

      return [input.some((v) => isTruthy(jqEval(m[1], v, vars)[0]))];
    }
  }

  if (expr === "any") {
    if (!Array.isArray(input)) {
      throw new JqError("any: not an array");
    }

    return [input.some(isTruthy)];
  }

  // all(expr) / all
  {
    const m = expr.match(/^all\((.+)\)$/s);
    if (m) {
      if (!Array.isArray(input)) {
        throw new JqError("all: not an array");
      }

      return [input.every((v) => isTruthy(jqEval(m[1], v, vars)[0]))];
    }
  }

  if (expr === "all") {
    if (!Array.isArray(input)) {
      throw new JqError("all: not an array");
    }

    return [input.every(isTruthy)];
  }

  // min / max
  if (expr === "min") {
    if (!Array.isArray(input) || input.length === 0) {
      return [null];
    }

    return [
      input.reduce((a, b) =>
        /** @type {any} */ (a) < /** @type {any} */ (b) ? a : b,
      ),
    ];
  }

  if (expr === "max") {
    if (!Array.isArray(input) || input.length === 0) {
      return [null];
    }

    return [
      input.reduce((a, b) =>
        /** @type {any} */ (a) > /** @type {any} */ (b) ? a : b,
      ),
    ];
  }

  // sort
  if (expr === "sort") {
    if (!Array.isArray(input)) {
      throw new JqError("sort: not an array");
    }

    return [
      [...input].sort((a, b) =>
        /** @type {any} */ (a) < /** @type {any} */ (b)
          ? -1
          : /** @type {any} */ (a) > /** @type {any} */ (b)
            ? 1
            : 0,
      ),
    ];
  }

  // unique
  if (expr === "unique") {
    if (!Array.isArray(input)) {
      throw new JqError("unique: not an array");
    }

    const seen = new Set();

    return [
      input.filter((v) => {
        const k = JSON.stringify(v);
        if (seen.has(k)) {
          return false;
        }

        seen.add(k);

        return true;
      }),
    ];
  }

  // reverse
  if (expr === "reverse") {
    if (!Array.isArray(input)) {
      throw new JqError("reverse: not an array");
    }

    return [[...input].reverse()];
  }

  // keys / keys_unsorted
  if (expr === "keys" || expr === "keys_unsorted") {
    if (Array.isArray(input)) {
      return [input.map((_, i) => i)];
    }

    if (typeof input === "object" && input !== null) {
      const ks = Object.keys(input);

      return [expr === "keys" ? ks.sort() : ks];
    }
  }

  // values
  if (expr === "values") {
    if (Array.isArray(input)) {
      return [input];
    }

    if (typeof input === "object" && input !== null)
      return [Object.values(input)];
  }

  // length
  if (expr === "length") {
    if (input === null) {
      return [0];
    }

    if (typeof input === "string") {
      return [input.length];
    }

    if (Array.isArray(input)) {
      return [input.length];
    }

    if (typeof input === "object") {
      return [Object.keys(input).length];
    }

    if (typeof input === "number") {
      return [Math.abs(input)];
    }
  }

  // type
  if (expr === "type") {
    if (input === null) {
      return ["null"];
    }

    if (Array.isArray(input)) {
      return ["array"];
    }

    return [typeof input];
  }

  // empty
  if (expr === "empty") {
    return [];
  }

  // not (standalone)
  if (expr === "not") {
    return [!isTruthy(input)];
  }

  // tostring / tonumber
  if (expr === "tostring") {
    return [typeof input === "string" ? input : JSON.stringify(input)];
  }

  if (expr === "tonumber") {
    return [Number(input)];
  }

  if (expr === "tojson") {
    return [JSON.stringify(input)];
  }

  if (expr === "fromjson") {
    return [JSON.parse(/** @type {string} */ (input))];
  }

  // ascii_downcase / ascii_upcase
  if (expr === "ascii_downcase") {
    return [/** @type {string} */ (input).toLowerCase()];
  }

  if (expr === "ascii_upcase") {
    return [/** @type {string} */ (input).toUpperCase()];
  }

  // ltrimstr / rtrimstr / startswith / endswith
  {
    const m = expr.match(/^ltrimstr\((.+)\)$/);
    if (m) {
      const s = /** @type {string} */ (input);
      const prefix = jqEval(m[1], input, vars)[0];

      return [
        s.startsWith(/** @type {string} */ (prefix))
          ? s.slice(/** @type {string} */ (prefix).length)
          : s,
      ];
    }
  }
  {
    const m = expr.match(/^rtrimstr\((.+)\)$/);
    if (m) {
      const s = /** @type {string} */ (input);
      const suffix = jqEval(m[1], input, vars)[0];

      return [
        s.endsWith(/** @type {string} */ (suffix))
          ? s.slice(0, -(/** @type {string} */ (suffix).length))
          : s,
      ];
    }
  }
  {
    const m = expr.match(/^startswith\((.+)\)$/);
    if (m)
      return [
        /** @type {string} */ (input).startsWith(
          /** @type {string} */ (jqEval(m[1], input, vars)[0]),
        ),
      ];
  }
  {
    const m = expr.match(/^endswith\((.+)\)$/);
    if (m)
      return [
        /** @type {string} */ (input).endsWith(
          /** @type {string} */ (jqEval(m[1], input, vars)[0]),
        ),
      ];
  }

  // split / join
  {
    const m = expr.match(/^split\((.+)\)$/);
    if (m) {
      const sep = jqEval(m[1], input, vars)[0];

      return [/** @type {string} */ (input).split(/** @type {string} */ (sep))];
    }
  }
  {
    const m = expr.match(/^join\((.+)\)$/);
    if (m) {
      const sep = jqEval(m[1], input, vars)[0];

      return [
        /** @type {unknown[]} */ (input)
          .map(String)
          .join(/** @type {string} */ (sep)),
      ];
    }
  }

  // test(regex)
  {
    const m = expr.match(/^test\((.+)\)$/);
    if (m) {
      const pattern = jqEval(m[1], input, vars)[0];

      return [
        new RegExp(/** @type {string} */ (pattern)).test(
          /** @type {string} */ (input),
        ),
      ];
    }
  }

  // @base64 / @base64d
  if (expr === "@base64") {
    return [btoa(unescape(encodeURIComponent(/** @type {string} */ (input))))];
  }
  if (expr === "@base64d") {
    return [decodeURIComponent(escape(atob(/** @type {string} */ (input))))];
  }

  // @uri
  if (expr === "@uri") {
    return [encodeURIComponent(/** @type {string} */ (input))];
  }

  // @html
  if (expr === "@html")
    return [
      /** @type {string} */ (input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&apos;")
        .replace(/"/g, "&quot;"),
    ];

  return undefined;
}

/**
 * Evaluate a path expression like `.foo`, `.[0]`, `.[]`, `.[1:3]`, `.foo.bar`.
 *
 * @param {string} expr
 * @param {unknown} input
 * @param {Record<string, unknown>} vars
 *
 * @returns {unknown}
 */
function evalPath(expr, input, vars) {
  if (expr === ".") {
    return input;
  }

  if (!expr.startsWith(".")) {
    throw new JqError(`jq: expression not recognized: ${expr}`);
  }

  // Strip leading dot and process segments
  let rest = expr.slice(1); // remove leading .
  let val = input;

  while (rest.length > 0) {
    // [N:M] slice
    const sliceM = rest.match(/^\[(-?\d*):(-?\d*)\](.*)/s);
    if (sliceM) {
      if (!Array.isArray(val) && typeof val !== "string") {
        throw new JqError("slice on non-array/string");
      }

      const len = /** @type {any[] | string} */ (val).length;
      const start = sliceM[1] === "" ? 0 : resolveIndex(Number(sliceM[1]), len);
      const end = sliceM[2] === "" ? len : resolveIndex(Number(sliceM[2]), len);
      val = /** @type {any} */ (val).slice(start, end);
      rest = sliceM[3];
      if (rest.startsWith(".")) {
        rest = rest.slice(1);
      }

      continue;
    }

    // [] iterator
    const iterM = rest.match(/^\[\](.*)/s);
    if (iterM) {
      // Return an array so callers can spread it; we mark it for jqEval to handle
      throw new IteratorSignal(val, iterM[1]);
    }

    // [N] or ["key"]
    const idxM = rest.match(/^\[(.+?)\](.*)/s);
    if (idxM) {
      const keyExpr = idxM[1];
      const key = jqEval(keyExpr, input, vars)[0];
      if (Array.isArray(val)) {
        const idx = resolveIndex(/** @type {number} */ (key), val.length);
        val = idx >= 0 && idx < val.length ? val[idx] : undefined;
      } else {
        val = /** @type {any} */ (val)?.[/** @type {string} */ (key)];
      }

      val = val === undefined ? null : val;
      rest = idxM[2];
      if (rest.startsWith(".")) {
        rest = rest.slice(1);
      }

      continue;
    }

    // .foo or .foo.bar — check builtin names first (e.g. .keys, .length, .type)
    const keyM = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)(.*)/s);
    if (keyM) {
      const keyName = keyM[1];
      const restAfter = keyM[2];
      // If keyName is a known builtin and the remaining path is empty, evaluate as builtin
      if (restAfter === "" || restAfter === ".") {
        const builtin = tryBuiltin(keyName, val, vars);
        if (builtin !== undefined) {
          val = builtin[0];
          rest = restAfter === "." ? "" : "";

          continue;
        }
      }

      val = /** @type {any} */ (val)?.[keyName];
      val = val === undefined ? null : val;

      rest = restAfter;
      if (rest.startsWith(".")) {
        rest = rest.slice(1);
      }

      continue;
    }

    throw new JqError(`jq: cannot parse path segment: ${rest}`);
  }

  return val;
}

/** Signal class for .[] iteration — caught in jqEval wrapper */
class IteratorSignal {
  /**
   * @param {unknown} src
   * @param {string} rest
   */
  constructor(src, rest) {
    this.src = src;
    this.rest = rest;
  }
}

/**
 * @param {string} expr
 * @param {unknown} input
 * @param {Record<string, unknown>} vars
 *
 * @returns {unknown[]}
 */
function evalExpr(expr, input, vars = {}) {
  try {
    return jqEval(expr, input, vars);
  } catch (e) {
    if (e instanceof IteratorSignal) {
      return evalIterSignal(e, expr, input, vars);
    }
    throw e;
  }
}

/**
 * @param {IteratorSignal} sig
 * @param {string} _origExpr
 * @param {unknown} _input
 * @param {Record<string, unknown>} vars
 *
 * @returns {unknown[]}
 */
function evalIterSignal(sig, _origExpr, _input, vars) {
  const src = sig.src;
  const rest = sig.rest;
  const items = Array.isArray(src)
    ? src
    : typeof src === "object" && src !== null
      ? Object.values(src)
      : [];
  if (!rest) {
    return items;
  }

  const out = [];
  for (const item of items) {
    out.push(...evalExpr("." + rest, item, vars));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {unknown} v */
function isTruthy(v) {
  return v !== null && v !== false && v !== undefined;
}

/**
 * Resolve a potentially-negative index into a non-negative one.
 *
 * @param {number} idx
 * @param {number} len
 */
function resolveIndex(idx, len) {
  return idx < 0 ? Math.max(0, len + idx) : idx;
}

/**
 * @param {unknown} val
 * @param {number} depth
 *
 * @returns {unknown[]}
 */
function flattenDeep(val, depth) {
  if (!Array.isArray(val)) {
    return /** @type {unknown[]} */ ([val]);
  }

  if (depth <= 0) {
    return val;
  }
  /** @type {unknown[]} */
  const out = [];
  for (const v of val) {
    if (Array.isArray(v)) out.push(...flattenDeep(v, depth - 1));
    else out.push(v);
  }

  return out;
}

/**
 * Delete a path from a value (immutable).
 *
 * @param {unknown} input
 * @param {string} pathExpr
 *
 * @returns {unknown}
 */
function jqDelete(input, pathExpr) {
  const m = pathExpr.match(/^\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (m) {
    if (typeof input !== "object" || input === null) {
      return input;
    }
    const out = { .../** @type {object} */ (input) };
    delete (/** @type {any} */ (out)[m[1]]);

    return out;
  }

  const mi = pathExpr.match(/^\.\[(-?\d+)\]$/);
  if (mi) {
    if (!Array.isArray(input)) {
      return input;
    }
    const idx = resolveIndex(Number(mi[1]), input.length);

    return [...input.slice(0, idx), ...input.slice(idx + 1)];
  }

  return input;
}

/**
 * Assign a value at a path (immutable).
 *
 * @param {unknown} input
 * @param {string} pathExpr
 * @param {unknown} val
 *
 * @returns {unknown}
 */
function jqAssign(input, pathExpr, val) {
  const m = pathExpr.match(/^\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (m) {
    return { .../** @type {object} */ (input), [m[1]]: val };
  }

  return input;
}

/**
 * Simple string interpolation: "...\(.expr)..."
 * @param {string} expr
 * @param {unknown} input
 * @param {Record<string, unknown>} vars
 *
 * @returns {string}
 */
function evalStringInterp(expr, input, vars) {
  if (!expr.startsWith('"')) {
    throw new JqError("not a string");
  }
  // Strip outer quotes
  const inner = expr.slice(1, -1);
  let out = "";
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === "\\" && inner[i + 1] === "(") {
      // find matching )
      let depth = 1;
      let j = i + 2;
      while (j < inner.length && depth > 0) {
        if (inner[j] === "(") depth++;
        else if (inner[j] === ")") depth--;
        j++;
      }

      const sub = inner.slice(i + 2, j - 1);
      const val = evalExpr(sub, input, vars)[0];
      out += typeof val === "string" ? val : JSON.stringify(val);
      i = j;
    } else if (inner[i] === "\\" && i + 1 < inner.length) {
      const esc = inner[i + 1];
      const escMap = /** @type {Record<string,string>} */ ({
        n: "\n",
        t: "\t",
        r: "\r",
        '"': '"',
        "\\": "\\",
      });
      out += escMap[esc] ?? esc;
      i += 2;
    } else {
      out += inner[i++];
    }
  }

  return out;
}

/**
 * Match if/then/else/end at the top level.
 *
 * @param {string} expr
 *
 * @returns {{ cond: string; then: string; else: string } | null}
 */
function matchIfThenElse(expr) {
  if (!expr.startsWith("if ") && !expr.startsWith("if(")) {
    return null;
  }
  // Find top-level then / else / end
  const cond = extractBetween(expr, "if ", "then");
  if (!cond) {
    return null;
  }

  const afterThen = expr.slice(expr.indexOf("then") + 4).trim();
  const elseIdx = topLevelKeyword(afterThen, "else");
  if (elseIdx === -1) {
    return null;
  }

  const thenExpr = afterThen.slice(0, elseIdx).trim();
  const afterElse = afterThen.slice(elseIdx + 4).trim();
  const endIdx = topLevelKeyword(afterElse, "end");
  const elseExpr =
    endIdx === -1 ? afterElse : afterElse.slice(0, endIdx).trim();
  return { cond: cond.trim(), then: thenExpr, else: elseExpr };
}

/**
 * Find the index of a keyword (whole word) at the top level (not inside parens/brackets/strings).
 *
 * @param {string} str
 * @param {string} kw
 *
 * @returns {number}
 */
function topLevelKeyword(str, kw) {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i <= str.length - kw.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === "\\") {
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

    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;

      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;

      continue;
    }

    if (depth === 0 && str.slice(i, i + kw.length) === kw) {
      const before = str[i - 1];
      const after = str[i + kw.length];
      if ((!before || /\W/.test(before)) && (!after || /\W/.test(after)))
        return i;
    }
  }

  return -1;
}

/**
 * Extract the content between two keywords at top level.
 *
 * @param {string} str
 * @param {string} start
 * @param {string} end
 *
 * @returns {string | null}
 */
function extractBetween(str, start, end) {
  const si = str.indexOf(start);
  if (si === -1) {
    return null;
  }

  const afterStart = str.slice(si + start.length);
  const ei = topLevelKeyword(afterStart, end);
  if (ei === -1) {
    return null;
  }

  return afterStart.slice(0, ei);
}

/**
 * Split expression on a top-level separator string.
 *
 * @param {string} expr
 * @param {string} sep
 *
 * @returns {string[]}
 */
function splitTopLevel(expr, sep) {
  const parts = [];
  let depth = 0;
  let inStr = false;
  let cur = "";
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (inStr) {
      cur += ch;
      if (ch === "\\" && i + 1 < expr.length) {
        cur += expr[++i];
      } else if (ch === '"') inStr = false;
      i++;

      continue;
    }

    if (ch === '"') {
      inStr = true;
      cur += ch;
      i++;

      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      cur += ch;
      i++;

      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      cur += ch;
      i++;

      continue;
    }

    if (depth === 0 && expr.slice(i, i + sep.length) === sep) {
      // For word separators, require word boundary
      if (/\w/.test(sep)) {
        const before = cur.slice(-1);
        const after = expr[i + sep.length] ?? "";
        if ((!before || /\W/.test(before)) && /\W/.test(after)) {
          parts.push(cur);
          cur = "";
          i += sep.length;

          continue;
        }
      } else {
        parts.push(cur);
        cur = "";
        i += sep.length;

        continue;
      }
    }
    cur += ch;
    i++;
  }
  parts.push(cur);
  return parts;
}

/**
 * Find index of operator at depth 0, excluding inside strings.
 * Used for comparison operators.
 *
 * @param {string} expr
 * @param {string} op
 *
 * @returns {number}
 */
function topLevelIndexOf(expr, op) {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i <= expr.length - op.length; i++) {
    const ch = expr[i];
    if (inStr) {
      if (ch === "\\") {
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

    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;

      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;

      continue;
    }

    if (depth === 0 && expr.slice(i, i + op.length) === op) {
      return i;
    }
  }

  return -1;
}

/**
 * Find the index of an arithmetic operator at top level, avoiding double-char ops.
 *
 * @param {string} expr
 * @param {string} op
 *
 * @returns {number}
 */
function topLevelArithIndex(expr, op) {
  let depth = 0;
  let inStr = false;
  // Skip leading unary minus
  const start = op === "-" ? 1 : 0;
  for (let i = start; i < expr.length; i++) {
    const ch = expr[i];
    if (inStr) {
      if (ch === "\\") {
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

    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;

      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;

      continue;
    }

    if (depth === 0 && ch === op) {
      // Skip double-char operators already handled (<=, >=, ==, !=, //)
      const prev = expr[i - 1];
      const next = expr[i + 1];
      if (op === "/" && next === "/") continue;
      if ((op === "<" || op === ">") && (next === "=" || prev === "="))
        continue;
      if (
        op === "=" &&
        (prev === "!" || prev === "<" || prev === ">" || prev === "=")
      )
        continue;
      if (op === "-") {
        // Unary minus: no left operand, or left non-space char is an operator/open paren
        const leftNonSpace = expr.slice(0, i).trimEnd().slice(-1);
        if (!leftNonSpace || /[+\-*\/%,(|]/.test(leftNonSpace)) continue;
      }

      return i;
    }
  }

  return -1;
}

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

/**
 * @typedef {{ rawOutput: boolean; compact: boolean; nullInput: boolean }} JqFlags
 */

/**
 * @param {string[]} args
 *
 * @returns {{ flags: JqFlags; program: string; file: string | null }}
 */
function parseJqArgs(args) {
  /** @type {JqFlags} */
  const flags = { rawOutput: false, compact: false, nullInput: false };
  let program = ".";
  let file = null;
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "-r" || a === "--raw-output") {
      flags.rawOutput = true;
      i++;

      continue;
    }

    if (a === "-c" || a === "--compact-output") {
      flags.compact = true;
      i++;

      continue;
    }

    if (a === "-n" || a === "--null-input") {
      flags.nullInput = true;
      i++;

      continue;
    }

    if (a === "-rc" || a === "-cr") {
      flags.rawOutput = true;
      flags.compact = true;
      i++;

      continue;
    }
    // Program is first non-flag positional
    if (!a.startsWith("-")) {
      if (program === ".") {
        program = a;
        i++;

        continue;
      }
      file = a;
      i++;

      continue;
    }
    i++;
  }

  return { flags, program, file };
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

/** @type {ShellCommandHandler} */
export async function jqCommand({ db, args, ctx, stdin, ok, fail }) {
  const { flags, program, file } = parseJqArgs(args);

  const rawText = file
    ? ((await safeRead(db, ctx.groupId, resolvePath(file, ctx))) ?? "")
    : flags.nullInput
      ? "null"
      : stdin;

  let input;
  try {
    input = JSON.parse(rawText.trim());
  } catch (e) {
    return {
      result: fail(`jq: ${e instanceof Error ? e.message : "parse error"}`),
    };
  }

  try {
    const outputs = evalExpr(program, input);

    const lines = outputs.map((v) => {
      if (flags.rawOutput && typeof v === "string") {
        return v;
      }

      return flags.compact ? JSON.stringify(v) : JSON.stringify(v, null, 2);
    });

    return { result: ok(lines.join("\n") + "\n") };
  } catch (e) {
    return {
      result: fail(`jq: ${e instanceof Error ? e.message : "eval error"}`),
    };
  }
}
