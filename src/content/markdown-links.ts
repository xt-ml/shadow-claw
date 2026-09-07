/**
 * ShadowClaw — Markdown link destination normalizer
 *
 * CommonMark / Marked specifications require link destinations containing spaces
 * to be enclosed in angle brackets `<...>` (e.g. `[text](<path with spaces.md>)`).
 *
 * This utility allows users to write natural Markdown links and image tags with spaces
 * in filenames and URLs without manually typing `%20` or `<...>`:
 *   [Doc](./My File With Spaces.md)       -> [Doc](<./My File With Spaces.md>)
 *   [Doc](folder/My File With Spaces.md)  -> [Doc](<folder/My File With Spaces.md>)
 *   [Link](https://example.com/My Page)   -> [Link](<https://example.com/My Page>)
 *   ![Img](./My Image.png)                -> ![Img](<./My Image.png>)
 *
 * Code blocks and inline code spans are strictly preserved.
 */

function normalizeDestination(rawInsideParens: string): string {
  const trimmed = rawInsideParens.trim();
  if (!trimmed) {
    return rawInsideParens;
  }

  // Check for an optional quoted title at the end: "title" or 'title'
  const titleMatch = trimmed.match(/\s+("[^"]*"|'[^']*')\s*$/);
  let dest: string;
  let titlePart = "";

  if (titleMatch && typeof titleMatch.index === "number") {
    dest = trimmed.slice(0, titleMatch.index).trim();
    titlePart = ` ${titleMatch[1]}`;
  } else {
    dest = trimmed;
  }

  // If already wrapped in angle brackets or has no spaces, do not modify
  if ((dest.startsWith("<") && dest.endsWith(">")) || !/[\s]/.test(dest)) {
    return rawInsideParens;
  }

  return `<${dest}>${titlePart}`;
}

/**
 * Normalizes link and image destinations containing spaces by enclosing them in CommonMark `<...>`.
 */
export function normalizeMarkdownLinks(markdown: string): string {
  if (typeof markdown !== "string" || !markdown.includes("[")) {
    return markdown;
  }

  const length = markdown.length;
  let result = "";
  let i = 0;

  while (i < length) {
    // 1. Check for fenced code blocks at start of line: ``` or ~~~
    const isStartOfLine = i === 0 || markdown[i - 1] === "\n";
    if (isStartOfLine && (markdown[i] === "`" || markdown[i] === "~")) {
      const char = markdown[i];
      let fenceLen = 1;
      while (i + fenceLen < length && markdown[i + fenceLen] === char) {
        fenceLen++;
      }

      if (fenceLen >= 3) {
        const fenceStr = char.repeat(fenceLen);
        const endOfOpeningLine = markdown.indexOf("\n", i + fenceLen);
        const searchStart =
          endOfOpeningLine === -1 ? length : endOfOpeningLine + 1;
        const closeIdx = markdown.indexOf(`\n${fenceStr}`, searchStart - 1);

        if (closeIdx !== -1) {
          const endOfClosingLine = markdown.indexOf(
            "\n",
            closeIdx + 1 + fenceLen,
          );
          const endIdx =
            endOfClosingLine === -1 ? length : endOfClosingLine + 1;
          result += markdown.slice(i, endIdx);
          i = endIdx;
          continue;
        } else {
          // Unclosed fence runs to the end
          result += markdown.slice(i);
          break;
        }
      }
    }

    // 2. Check for inline code spans: ` or `` etc.
    if (markdown[i] === "`") {
      let backtickCount = 1;
      while (
        i + backtickCount < length &&
        markdown[i + backtickCount] === "`"
      ) {
        backtickCount++;
      }
      const backticks = "`".repeat(backtickCount);
      const closeIdx = markdown.indexOf(backticks, i + backtickCount);

      if (closeIdx !== -1) {
        const endIdx = closeIdx + backtickCount;
        result += markdown.slice(i, endIdx);
        i = endIdx;
        continue;
      }
    }

    // 3. Check for link or image: ![...](...) or [...](...)
    const isImage =
      markdown[i] === "!" && i + 1 < length && markdown[i + 1] === "[";
    const isLink = markdown[i] === "[";

    if (isImage || isLink) {
      const labelStart = isImage ? i + 2 : i + 1;
      let depth = 1;
      let j = labelStart;

      while (j < length && depth > 0) {
        if (markdown[j] === "\\") {
          j += 2; // Skip escaped character
          continue;
        }
        if (markdown[j] === "[") {
          depth++;
        } else if (markdown[j] === "]") {
          depth--;
        }
        if (depth > 0) {
          j++;
        }
      }

      // If we found the matching ']' and the next non-whitespace or immediate char is '('
      if (depth === 0 && j < length && markdown[j] === "]") {
        const labelEnd = j;
        const nextCharIdx = j + 1;

        if (nextCharIdx < length && markdown[nextCharIdx] === "(") {
          // Find matching ')'
          let parenDepth = 1;
          let k = nextCharIdx + 1;

          while (k < length && parenDepth > 0) {
            if (markdown[k] === "\\") {
              k += 2;
              continue;
            }
            if (markdown[k] === "(") {
              parenDepth++;
            } else if (markdown[k] === ")") {
              parenDepth--;
            }
            if (parenDepth > 0) {
              k++;
            }
          }

          if (parenDepth === 0 && k < length && markdown[k] === ")") {
            const rawInsideLabel = markdown.slice(labelStart, labelEnd);
            const rawInsideParens = markdown.slice(nextCharIdx + 1, k);

            // Recursively normalize label in case there are nested links/images
            const normalizedLabel = rawInsideLabel.includes("[")
              ? normalizeMarkdownLinks(rawInsideLabel)
              : rawInsideLabel;

            const normalizedInsideParens =
              normalizeDestination(rawInsideParens);
            const prefix = isImage ? "![" : "[";

            result += `${prefix}${normalizedLabel}](${normalizedInsideParens})`;
            i = k + 1;
            continue;
          }
        }
      }
    }

    // Default: append current character
    result += markdown[i];
    i++;
  }

  return result;
}
