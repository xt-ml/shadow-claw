/**
 * ShadowClaw — Markdown → HTML renderer using Marked + DOMPurify + Highlight.js
 *
 * Uses marked for robust Markdown parsing, Highlight.js for syntax highlighting,
 * and DOMPurify for sanitization. Supports all common Markdown including tables,
 * code blocks, links, images, etc.
 */

import hljs from "highlight.js";
import { marked } from "marked";

import {
  createFrontmatterDetailsElement,
  PostFrontmatter,
  renderFrontmatterMarkup,
  splitFrontmatter,
} from "../common/utils/frontmatter.mjs";

import {
  ensureIframeSanitizerHook,
  getDOMPurify,
} from "../security/iframe-sanitizer.js";
import { isAllowedCustomElement } from "../security/custom-element-security.js";

export interface MarkdownRenderOptions {
  breaks?: boolean;
  renderFrontmatter?: boolean;
}

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

    heading(
      this: any,
      token: { text: string; depth: number; tokens?: any[] } | string,
      level?: number,
    ) {
      // Normalize across different marked versions
      const rawText =
        typeof token === "object" && "text" in token
          ? token.text
          : String(token);
      const depth =
        typeof token === "object" && "depth" in token
          ? token.depth
          : (level ?? 1);

      // Parse the tokens to get the proper HTML string (e.g. for links inside headings)
      let innerHTML = rawText;
      if (
        typeof token === "object" &&
        "tokens" in token &&
        token.tokens &&
        this.parser
      ) {
        innerHTML = this.parser.parseInline(token.tokens);
      }

      // Generate a GitHub-style slug from the parsed text: strip HTML tags and entities, lowercase, replace non-alphanumeric with hyphens
      const plainText = innerHTML
        .replace(/<[^>]+>/g, "") // Strip HTML tags
        .replace(/&(?:[a-z\d]+|#\d+|#x[a-f\d]+);/gi, ""); // Strip HTML entities

      const baseSlug = plainText
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/gu, "")
        .replace(/[\s_]+/gu, "-")
        .replace(/-+/gu, "-")
        .replace(/^-|-$/gu, "");

      let slug = baseSlug;
      const counts = this.options?.headingCounts;
      if (counts instanceof Map) {
        const count = counts.get(baseSlug) || 0;
        counts.set(baseSlug, count + 1);
        if (count > 0) {
          slug = `${baseSlug}-${count}`;
        }
      }

      return `<h${depth} id="${slug}">${innerHTML}</h${depth}>\n`;
    },
  },
});

/**
 * Render a Markdown string to safe HTML.
 */
export async function renderMarkdown(
  src: string,
  options?: MarkdownRenderOptions,
): Promise<string> {
  try {
    const parsed: { data: PostFrontmatter; content: string } =
      splitFrontmatter(src);

    // Parse markdown to HTML
    const headingCounts = new Map<string, number>();
    const html = await marked.parse(parsed.content, {
      gfm: true,
      breaks: options?.breaks ?? false,
      headingCounts,
    } as any);

    // Ensure DOMPurify has the iframe sanitizer hook registered
    ensureIframeSanitizerHook();

    // Sanitize with DOMPurify to remove any dangerous content
    const safe = getDOMPurify().sanitize(html, {
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
        "figure",
        "figcaption",
        "iframe",
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
        "frameborder",
        "allow",
        "allowfullscreen",
        "referrerpolicy",
        "sandbox",
        "scrolling",
      ],
      ADD_TAGS: ["iframe", "figure", "figcaption"],
      CUSTOM_ELEMENT_HANDLING: {
        tagNameCheck: (tagName: string) => isAllowedCustomElement(tagName),
        attributeNameCheck: () => true,
        allowCustomizedBuiltInElements: false,
      },
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "scrolling",
        "referrerpolicy",
        "loading",
      ],
      ALLOW_DATA_ATTR: false,
      RETURN_DOM: false,
    });

    const shouldRenderFrontmatter = options?.renderFrontmatter ?? true;
    if (!shouldRenderFrontmatter || Object.keys(parsed.data).length === 0) {
      return safe;
    }

    return `${renderFrontmatterMarkup(parsed.data, createFrontmatterDetailsElement)}${safe}`;
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
