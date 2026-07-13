import { consumeEscapeSequence } from "./consumeEscapeSequence.js";
import { stripInternalVMNoise } from "./stripInternalVMNoise.js";

/**
 * Apply minimal terminal control character handling to the visible buffer.
 *
 * Returns the updated text and any trailing incomplete escape sequence to be
 * prepended to the next chunk (cross-chunk boundary handling).
 */
export function normalizeTerminalText(
  current: string,
  chunk: string,
  pendingEscape = "",
  options: { respectEraseSequences?: boolean },
) {
  const respectEraseSequences = options?.respectEraseSequences ?? true;
  const input = pendingEscape + chunk;
  let next = current;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (char === "\u001b") {
      const escape = consumeEscapeSequence(input, index);

      if (escape.incomplete) {
        return { text: next, pending: input.slice(index) };
      }

      if (escape.action === "clear-screen" && respectEraseSequences) {
        next = "";
      }

      if (escape.action === "clear-line" && respectEraseSequences) {
        const lastLineBreak = next.lastIndexOf("\n");
        next = lastLineBreak === -1 ? "" : next.slice(0, lastLineBreak + 1);
      }

      index = escape.nextIndex - 1;

      continue;
    }

    if (char === "\r") {
      const nextChar = input[index + 1];

      if (nextChar === "\n") {
        // CRLF: skip the CR, let the LF be processed normally.

        continue;
      }

      if (nextChar !== undefined) {
        // Lone CR within the same chunk: cursor back to column 0,
        // overwriting the current line (e.g. shell prompt redraw).
        const lastLineBreak = next.lastIndexOf("\n");
        next = lastLineBreak === -1 ? "" : next.slice(0, lastLineBreak + 1);

        continue;
      }

      // CR at end of chunk — we can't tell yet whether it's CR or CRLF.
      // Defer it so the next chunk can resolve the ambiguity.

      return { text: next, pending: "\r" };
    }

    if (char === "\b" || char === "\u007f") {
      next = next.slice(0, -1);

      continue;
    }

    if ((char < " " && char !== "\n" && char !== "\t") || char === "\u0007") {
      continue;
    }

    next += char;
  }

  // Drop internal command protocol noise used by VM command execution.
  next = stripInternalVMNoise(next);

  return { text: next, pending: "" };
}
