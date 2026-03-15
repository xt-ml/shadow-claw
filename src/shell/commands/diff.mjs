import { safeRead } from "../safeRead.mjs";
import { resolvePath } from "../resolvePath.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/**
 * @param {string} content
 *
 * @returns {string[]}
 */
function toLines(content) {
  const normalized = content.replace(/\r\n/gu, "\n");
  return normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");
}

/**
 * @param {string[]} left
 * @param {string[]} right
 * @param {string} leftLabel
 * @param {string} rightLabel
 */
function renderUnified(left, right, leftLabel, rightLabel) {
  const out = [`--- ${leftLabel}`, `+++ ${rightLabel}`];
  const max = Math.max(left.length, right.length);
  out.push(`@@ -1,${left.length} +1,${right.length} @@`);

  for (let i = 0; i < max; i++) {
    const l = left[i];
    const r = right[i];

    if (l === r && l !== undefined) {
      out.push(` ${l}`);

      continue;
    }

    if (l !== undefined) {
      out.push(`-${l}`);
    }

    if (r !== undefined) {
      out.push(`+${r}`);
    }
  }

  return `${out.join("\n")}\n`;
}

/** @type {ShellCommandHandler} */
export async function diffCommand({ db, args, ctx, stdin, ok, fail }) {
  let quiet = false;
  let unified = false;
  /** @type {string[]} */
  const labels = [];
  /** @type {string[]} */
  const operands = [];

  for (let i = 0; i < args.length; i++) {
    const token = args[i];

    if (token === "-q") {
      quiet = true;

      continue;
    }

    if (token === "-u") {
      unified = true;

      continue;
    }

    if (token === "-L") {
      const label = args[++i];
      if (label === undefined) {
        return { result: fail("diff: option requires an argument -- 'L'", 2) };
      }

      labels.push(label);

      continue;
    }

    if (token !== "-" && token.startsWith("-")) {
      return { result: fail(`diff: unrecognized option '${token}'`, 2) };
    }

    operands.push(token);
  }

  if (operands.length !== 2) {
    return { result: fail("diff: missing operand", 2) };
  }

  const [leftOperand, rightOperand] = operands;

  /** @param {string} operand */
  const readOperand = async (operand) => {
    if (operand === "-") {
      return stdin;
    }

    const path = resolvePath(operand, ctx);
    const content = await safeRead(db, ctx.groupId, path);
    if (content === null) {
      throw new Error(operand);
    }

    return content;
  };

  let leftContent;
  let rightContent;

  try {
    leftContent = await readOperand(leftOperand);
    rightContent = await readOperand(rightOperand);
  } catch (error) {
    const missing = error instanceof Error ? error.message : String(error);
    return { result: fail(`diff: ${missing}: No such file or directory`, 2) };
  }

  if (leftContent === rightContent) {
    return { result: ok("") };
  }

  if (quiet) {
    return {
      result: {
        stdout: `Files ${leftOperand} and ${rightOperand} differ\n`,
        stderr: "",
        exitCode: 1,
      },
    };
  }

  const leftLabel = labels[0] ?? leftOperand;
  const rightLabel = labels[1] ?? rightOperand;
  const leftLines = toLines(leftContent);
  const rightLines = toLines(rightContent);

  const stdout = unified
    ? renderUnified(leftLines, rightLines, leftLabel, rightLabel)
    : renderUnified(leftLines, rightLines, leftLabel, rightLabel);

  return {
    result: {
      stdout,
      stderr: "",
      exitCode: 1,
    },
  };
}
