/**
 * ShadowClaw — Markdown → HTML renderer using Marked + DOMPurify + Highlight.js
 *
 * Uses marked for robust Markdown parsing, Highlight.js for syntax highlighting,
 * and DOMPurify for sanitization. Supports all common Markdown including tables,
 * code blocks, links, images, etc.
 */

import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { marked } from "marked";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeLanguageClass(lang?: string): string {
  if (typeof lang !== "string" || lang.length === 0) {
    return "plaintext";
  }

  const cleaned = lang
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_+-]/g, "");

  return cleaned || "plaintext";
}

function extractCodeAndLang(
  codeOrToken: string | { text?: string; lang?: string },
  maybeLang?: string,
): { text: string; lang?: string } {
  if (typeof codeOrToken === "string") {
    return {
      text: codeOrToken,
      lang: typeof maybeLang === "string" ? maybeLang : undefined,
    };
  }

  return {
    text: typeof codeOrToken?.text === "string" ? codeOrToken.text : "",
    lang: typeof codeOrToken?.lang === "string" ? codeOrToken.lang : undefined,
  };
}

// Configure marked with a custom renderer for code blocks (compatible with marked v17+)
marked.use({
  renderer: {
    code(
      codeOrToken: string | { text?: string; lang?: string },
      maybeLang?: string,
    ) {
      const { text, lang } = extractCodeAndLang(codeOrToken, maybeLang);
      const language = sanitizeLanguageClass(lang);
      let highlighted = escapeHtml(text);

      try {
        // Handle various hljs import patterns defensively
        const h =
          typeof hljs?.getLanguage === "function"
            ? hljs
            : typeof hljs?.getLanguage === "function"
              ? hljs
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
 */
export async function renderMarkdown(
  src: string,
  options?: { breaks?: boolean },
): Promise<string> {
  try {
    // Parse markdown to HTML
    const html = await marked.parse(src, {
      gfm: true,
      breaks: options?.breaks ?? false,
    });

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
