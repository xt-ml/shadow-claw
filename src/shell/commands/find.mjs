import { listGroupFiles } from "../../storage/listGroupFiles.mjs";
import { safeRead } from "../safeRead.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/**
 * @param {string} value
 *
 * @returns {string}
 */
function escapeGlobRegex(value) {
  return value.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
}

/**
 * @param {string} pattern
 * @param {boolean} insensitive
 *
 * @returns {RegExp}
 */
function buildGlobRegex(pattern, insensitive) {
  const source = `^${escapeGlobRegex(pattern).replace(/\*/gu, ".*").replace(/\?/gu, ".")}$`;
  return new RegExp(source, insensitive ? "iu" : "u");
}

/**
 * @param {string} path
 *
 * @returns {string}
 */
function baseName(path) {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? ".";
}

/**
 * @param {string} root
 * @param {string} path
 *
 * @returns {string}
 */
function renderPath(root, path) {
  if (root === ".") {
    if (path === ".") {
      return ".";
    }

    return `./${path}`;
  }

  return path;
}

/**
 * @param {string[]} args
 */
function parseFindArgs(args) {
  const roots = [];
  let i = 0;

  while (i < args.length && !args[i].startsWith("-")) {
    roots.push(args[i]);
    i++;
  }

  const expression = args.slice(i);
  let namePattern = null;
  let inamePattern = null;
  let typeFilter = null;
  let maxDepth = Number.POSITIVE_INFINITY;
  let minDepth = 0;
  let explicitFalse = false;

  for (let j = 0; j < expression.length; j++) {
    const token = expression[j];

    if (token === "-name") {
      namePattern = expression[++j] ?? null;

      continue;
    }

    if (token === "-iname") {
      inamePattern = expression[++j] ?? null;

      continue;
    }

    if (token === "-type") {
      typeFilter = expression[++j] ?? null;

      continue;
    }

    if (token === "-maxdepth") {
      const parsed = Number(expression[++j]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        maxDepth = parsed;
      }
      continue;
    }

    if (token === "-mindepth") {
      const parsed = Number(expression[++j]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        minDepth = parsed;
      }
      continue;
    }

    if (token === "-false") {
      explicitFalse = true;

      continue;
    }

    if (token === "-true" || token === "-print") {
      continue;
    }

    return {
      error: `find: unsupported expression '${token}'`,
    };
  }

  return {
    roots: roots.length > 0 ? roots : ["."],
    namePattern,
    inamePattern,
    typeFilter,
    maxDepth,
    minDepth,
    explicitFalse,
    error: null,
  };
}

/** @type {ShellCommandHandler} */
export async function findCommand({ db, args, ctx, ok, fail }) {
  const parsed = parseFindArgs(args);
  if (parsed.error) {
    return { result: fail(parsed.error) };
  }

  const {
    roots,
    namePattern,
    inamePattern,
    typeFilter,
    maxDepth,
    minDepth,
    explicitFalse,
  } = parsed;

  if (typeFilter !== null && typeFilter !== "f" && typeFilter !== "d") {
    return { result: fail(`find: unsupported -type '${typeFilter}'`) };
  }

  const nameRegex = namePattern ? buildGlobRegex(namePattern, false) : null;
  const inameRegex = inamePattern ? buildGlobRegex(inamePattern, true) : null;

  /** @type {string[]} */
  const out = [];

  /**
   * @param {string} root
   * @param {string} path
   * @param {number} depth
   * @param {boolean | null} knownIsDir
   */
  const walk = async (root, path, depth, knownIsDir = null) => {
    /** @type {string[]} */
    let entries = [];
    let isDir = knownIsDir === true;

    if (knownIsDir !== false) {
      try {
        entries = await listGroupFiles(db, ctx.groupId, path);
        isDir = true;
      } catch {
        const content = await safeRead(db, ctx.groupId, path);
        if (content === null) {
          throw new Error(path);
        }

        isDir = false;
      }
    }

    const name = baseName(path);
    const meetsType =
      typeFilter === null ||
      (typeFilter === "d" && isDir) ||
      (typeFilter === "f" && !isDir);
    const meetsName = nameRegex ? nameRegex.test(name) : true;
    const meetsIName = inameRegex ? inameRegex.test(name) : true;
    const meetsDepth = depth >= minDepth && depth <= maxDepth;

    if (!explicitFalse && meetsType && meetsName && meetsIName && meetsDepth) {
      out.push(renderPath(root, path));
    }

    if (!isDir || depth >= maxDepth) {
      return;
    }

    for (const entry of entries) {
      const entryIsDir = entry.endsWith("/");
      const entryName = entryIsDir ? entry.slice(0, -1) : entry;
      const childPath = path === "." ? entryName : `${path}/${entryName}`;
      await walk(root, childPath, depth + 1, entryIsDir);
    }
  };

  try {
    for (const rootArg of roots) {
      const root = resolvePath(rootArg, ctx);
      await walk(root, root, 0);
    }
  } catch (error) {
    const missing = error instanceof Error ? error.message : String(error);
    return { result: fail(`find: ${missing}: No such file or directory`) };
  }

  return { result: ok(out.length > 0 ? `${out.join("\n")}\n` : "") };
}
