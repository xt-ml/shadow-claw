/**
 * @module truncateToolOutput
 *
 * Intelligently truncate large tool outputs at natural boundaries
 * (line breaks) rather than cutting mid-content.
 */

/**
 * Truncate a tool output string if it exceeds maxChars.
 * Tries to cut at a line boundary and appends a truncation indicator.
 */
export function truncateToolOutput(
  content: string | null | undefined,
  maxChars: number,
): string {
  if (!content) {
    return "";
  }

  if (content.length <= maxChars) {
    return content;
  }

  // Try to find a line boundary within the budget
  const slice = content.slice(0, maxChars);
  const lastNewline = slice.lastIndexOf("\n");

  const cutPoint = lastNewline > maxChars * 0.5 ? lastNewline : maxChars;
  const kept = content.slice(0, cutPoint);
  const actualTruncated = content.length - cutPoint;

  return `${kept}\n[...truncated ${actualTruncated} chars]`;
}
