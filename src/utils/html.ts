/**
 * Environment-agnostic HTML utility functions (isomorphic across Node.js, Web Worker, and Browser).
 *
 * @module html
 */

/**
 * Escape HTML special characters in a string without requiring DOM APIs.
 */
export function escapeHtml(value: string): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Decode common HTML entities back to characters.
 */
export function unescapeHtml(value: string): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Extract the inner content of the first matching tag from HTML.
 * Returns null if the tag is not found.
 */
function extractTag(html: string, tag: string): string | null {
  const openPattern = new RegExp(`<${tag}[^>]*>`, "i");
  const match = html.match(openPattern);
  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index + match[0].length;
  const closePattern = new RegExp(`</${tag}>`, "i");
  const closeMatch = html.slice(start).match(closePattern);
  if (!closeMatch || closeMatch.index === undefined) {
    return null;
  }

  return html.slice(start, start + closeMatch.index);
}

/**
 * Remove all occurrences of specific HTML tags and their content.
 */
function removeTags(html: string, tags: string[]): string {
  let result = html;
  for (const tag of tags) {
    result = result.replace(
      new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi"),
      "",
    );
  }

  return result;
}

/**
 * Decode common HTML entities and collapse whitespace.
 */
function decodeAndNormalize(text: string): string {
  let result = text;
  result = result.replace(/<[^>]+>/g, " ");
  result = result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");

  result = result
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .replace(/ \n/g, "\n")
    .trim();

  return result;
}

/**
 * Extract readable text from HTML.
 *
 * For HTML documents, this function attempts intelligent content extraction:
 *   1. Prefer the content of <main> or <article> elements when present
 *   2. Strip noisy elements: <nav>, <footer>, <header>, <aside>
 *   3. Always strip <script>, <style>, <noscript>, <svg>, <head>
 *   4. Decode entities and collapse whitespace
 */
export function stripHtml(html: string): string {
  if (!html) {
    return "";
  }

  // Try to extract focused content from <main> or <article> first.
  const mainContent = extractTag(html, "main") || extractTag(html, "article");

  let source = mainContent || html;

  // Remove non-content tags.
  source = removeTags(source, [
    "script",
    "style",
    "noscript",
    "svg",
    "head",
    "nav",
    "footer",
    "header",
    "aside",
  ]);

  // Remove HTML comments.
  source = source.replace(/<!--[\s\S]*?-->/g, "");

  return decodeAndNormalize(source);
}

/**
 * Escapes characters that can terminate or corrupt a <script> tag containing JSON.
 */
export function escapeJsonForHtmlScript(jsonString: string): string {
  return jsonString
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
