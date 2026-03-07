/**
 * Extract readable text from HTML
 *
 * @param {string} html
 *
 * @returns {string}
 */
export function stripHtml(html) {
  let text = html;
  text = text.replace(
    /<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  return text;
}
