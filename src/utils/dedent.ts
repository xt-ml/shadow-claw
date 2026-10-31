/**
 * Dedents text if it has uniform leading whitespace (e.g. when embedded in an indented HTML script tag).
 */
export function dedentLeadingWhitespace(text: string): string {
  if (!text) {
    return "";
  }
  const leadingMatch = text.match(/^\r?\n([ \t]+)/);
  if (leadingMatch) {
    const indent = leadingMatch[1];
    const regex = new RegExp(`^[ \\t]{1,${indent.length}}`, "gm");
    return text
      .replace(/^\r?\n/, "")
      .replace(regex, "")
      .replace(/\r?\n[ \t]*$/, "\n");
  }
  if (/^(?:\r?\n)+[ \t]*---/.test(text)) {
    return text.replace(/^(?:\r?\n)+/, "");
  }
  if (/^[ \t]+---/.test(text)) {
    const indentMatch = text.match(/^[ \t]+/);
    if (indentMatch) {
      const indent = indentMatch[0];
      const regex = new RegExp(`^[ \\t]{1,${indent.length}}`, "gm");
      return text.replace(regex, "");
    }
  }
  return text;
}
