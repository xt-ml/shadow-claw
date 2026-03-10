/**
 * ShadowClaw — Markdown → HTML renderer using Marked + DOMPurify + Highlight.js
 *
 * Uses marked for robust Markdown parsing, Highlight.js for syntax highlighting,
 * and DOMPurify for sanitization. Supports all common Markdown including tables,
 * code blocks, links, images, etc.
 */

// @ts-ignore
import DOMPurify from "dompurify";
// @ts-ignore
import { marked } from "marked";
// @ts-ignore
import hljs from "highlight.js";

// Configure marked with a custom renderer for code blocks (compatible with marked v17+)
marked.use({
  renderer: {
    /**
     * @param {{ text: string; lang?: string }} options
     */
    code({ text, lang }) {
      const language = lang || "plaintext";
      let highlighted = text;

      try {
        // Handle various hljs import patterns defensively
        const h =
          typeof hljs?.getLanguage === "function"
            ? hljs
            : typeof hljs?.default?.getLanguage === "function"
              ? hljs.default
              : null;

        if (h && lang && h.getLanguage(lang)) {
          highlighted = h.highlight(text, {
            language: lang,
            ignoreIllegals: true,
          }).value;
        }
      } catch (err) {
        console.warn("Highlight.js rendering warning:", err);
      }

      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    },
  },
});

/**
 * Render a Markdown string to safe HTML.
 * @param {string} src
 *
 * @returns {string}
 */
export function renderMarkdown(src) {
  try {
    // Parse markdown to HTML
    const html = marked.parse(src);

    // Sanitize with DOMPurify to remove any dangerous content
    const safe = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "del",
        "s",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "code",
        "pre",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "a",
        "img",
        "hr",
        "svg",
        "g",
        "path",
        "line",
        "rect",
        "circle",
        "ellipse",
        "polygon",
        "polyline",
        "text",
        "tspan",
        "defs",
        "use",
        "marker",
        "linearGradient",
        "radialGradient",
        "stop",
        "div",
        "span",
      ],
      ALLOWED_ATTR: [
        "href",
        "title",
        "target",
        "rel",
        "src",
        "alt",
        "loading",
        "width",
        "height",
        "class",
        "style",
        "id",
        "colspan",
        "rowspan",
        "align",
        "viewBox",
        "preserveAspectRatio",
        "xmlns",
        "xmlns:xlink",
        "d",
        "fill",
        "stroke",
        "stroke-width",
        "cx",
        "cy",
        "r",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "points",
        "text-anchor",
        "font-size",
        "font-family",
        "xlink:href",
      ],
      ALLOW_DATA_ATTR: false,
      RETURN_DOM: false,
    });

    return safe;
  } catch (err) {
    console.error("Markdown rendering error details:", {
      error: err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      srcLength: src?.length,
    });
    // Fallback: return escaped text
    const div = document.createElement("div");
    div.textContent = src;
    return `<p>${div.innerHTML}</p>`;
  }
}
