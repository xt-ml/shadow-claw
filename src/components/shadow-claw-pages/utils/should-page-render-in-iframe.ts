import { isHtmlPath } from "./page-file-types.js";

/**
 * Determines whether a page should be rendered within a sandboxed <iframe> (the default)
 * or directly into the shadow DOM (for sites like karlherrick.com / infinitym.ca).
 *
 * Precedence:
 * 1. Frontmatter: `iframe: false` | `render: "shadow" | "direct"` -> false; `iframe: true` -> true
 * 2. SiteConfig `pages`:
 *    - `pages.directPages` / `pages.shadowDomPages`: if matched -> false
 *    - `pages.iframePages`: if matched -> true
 *    - `pages.iframe: false` | `pages.render: "shadow" | "direct"` | `pages.shadowDom: true` -> false
 *    - `pages.iframe: true` | `pages.render: "iframe"` -> true
 * 3. Default: true for HTML pages (sandboxed iframe), false for markdown / non-HTML.
 */
export function shouldPageRenderInIframe(
  pagePath: string,
  frontmatter?: Record<string, any> | null,
  siteConfig?: Record<string, any> | null,
): boolean {
  if (!pagePath || !isHtmlPath(pagePath)) {
    return false;
  }

  // 1. Frontmatter takes precedence
  if (frontmatter && typeof frontmatter === "object") {
    if (typeof frontmatter.iframe === "boolean") {
      return frontmatter.iframe;
    }
    if (typeof frontmatter.iframe === "string") {
      const lower = frontmatter.iframe.trim().toLowerCase();
      if (lower === "false" || lower === "0" || lower === "no") return false;
      if (lower === "true" || lower === "1" || lower === "yes") return true;
    }
    if (typeof frontmatter.render === "string") {
      const lower = frontmatter.render.trim().toLowerCase();
      if (lower === "shadow" || lower === "direct" || lower === "shadowdom") {
        return false;
      }
      if (lower === "iframe") {
        return true;
      }
    }
    if (typeof frontmatter.shadowDom === "boolean") {
      return !frontmatter.shadowDom;
    }
  }

  // 2. Resolve siteConfig if not provided
  let config = siteConfig;
  if (!config && typeof document !== "undefined") {
    try {
      const scriptEl = document.getElementById("shadow-claw-site-config");
      if (scriptEl?.textContent) {
        config = JSON.parse(scriptEl.textContent);
      }
    } catch {}
  }

  // 3. SiteConfig checks
  if (config?.pages && typeof config.pages === "object") {
    const pages = config.pages as Record<string, any>;
    const cleanPath = pagePath
      .replace(/^\/+/, "")
      .replace(/^pages\/[^/]+\//, "");

    if (
      Array.isArray(pages.directPages) ||
      Array.isArray(pages.shadowDomPages)
    ) {
      const list = (pages.directPages || pages.shadowDomPages) as string[];
      if (
        list.some((p) => {
          const c = String(p)
            .replace(/^\/+/, "")
            .replace(/^pages\/[^/]+\//, "");
          return c === cleanPath || c === pagePath;
        })
      ) {
        return false;
      }
    }

    if (Array.isArray(pages.iframePages)) {
      if (
        pages.iframePages.some((p: string) => {
          const c = String(p)
            .replace(/^\/+/, "")
            .replace(/^pages\/[^/]+\//, "");
          return c === cleanPath || c === pagePath;
        })
      ) {
        return true;
      }
    }

    if (typeof pages.iframe === "boolean") {
      return pages.iframe;
    }
    if (typeof pages.iframe === "string") {
      const lower = pages.iframe.trim().toLowerCase();
      if (lower === "false" || lower === "0" || lower === "no") return false;
      if (lower === "true" || lower === "1" || lower === "yes") return true;
    }
    if (typeof pages.render === "string") {
      const lower = pages.render.trim().toLowerCase();
      if (lower === "shadow" || lower === "direct" || lower === "shadowdom") {
        return false;
      }
      if (lower === "iframe") {
        return true;
      }
    }
    if (typeof pages.shadowDom === "boolean") {
      return !pages.shadowDom;
    }
  }

  // 4. Default: iframe setup is enabled by default
  return true;
}
