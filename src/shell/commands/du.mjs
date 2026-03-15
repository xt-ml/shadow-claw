import { listGroupFiles } from "../../storage/listGroupFiles.mjs";
import { safeRead } from "../safeRead.mjs";
import { parseFlags } from "../parseFlags.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */
/** @typedef {import("../../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase */

/**
 * @param {number} bytes
 *
 * @returns {number}
 */
function toKb(bytes) {
  return Math.ceil(bytes / 1024);
}

/**
 * Walk a directory recursively, returning [totalBytes, outputLines].
 * outputLines are bottom-up: subdirectories before their parent.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} path
 *
 * @returns {Promise<[number, string[]]>}
 */
async function walkDir(db, groupId, path) {
  const entries = await listGroupFiles(db, groupId, path);
  let totalBytes = 0;
  /** @type {string[]} */
  const lines = [];

  for (const entry of entries) {
    if (entry.endsWith("/")) {
      const subName = entry.slice(0, -1);
      const subPath = path === "." ? subName : `${path}/${subName}`;
      const [subBytes, subLines] = await walkDir(db, groupId, subPath);
      totalBytes += subBytes;
      lines.push(...subLines, `${toKb(subBytes)}\t${subPath}`);
    } else {
      const filePath = path === "." ? entry : `${path}/${entry}`;
      const content = await safeRead(db, groupId, filePath);
      totalBytes += content?.length ?? 0;
    }
  }

  return [totalBytes, lines];
}

/** @type {ShellCommandHandler} */
export async function duCommand({ db, args, ctx, ok, fail }) {
  const { flags, operands } = parseFlags(args, [], ["s", "k", "h", "a"]);
  const summary = flags.s !== undefined;
  const targets = operands.length > 0 ? operands : ["."];

  const allLines = [];

  for (const target of targets) {
    const resolved = resolvePath(target, ctx);

    let totalBytes;
    /** @type {string[]} */
    let subLines;

    // First try it as a directory
    try {
      [totalBytes, subLines] = await walkDir(db, ctx.groupId, resolved);
    } catch {
      // Try as a file
      const content = await safeRead(db, ctx.groupId, resolved);
      if (content === null) {
        return { result: fail(`du: ${target}: No such file or directory`) };
      }
      totalBytes = content.length;
      subLines = [];
    }

    if (!summary) {
      allLines.push(...subLines);
    }

    allLines.push(`${toKb(totalBytes)}\t${target}`);
  }

  return { result: ok(allLines.join("\n") + "\n") };
}
