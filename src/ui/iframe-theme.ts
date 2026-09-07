import { applyBasePath } from "../core/app-routes.js";

/**
 * Prefixes whose contents are flattened into the distribution root.
 */
const FLATTENED_STYLESHEET_PREFIXES = [
  "pages/resources/",
  "pages/deps/",
  "resources/",
  "deps/",
  "pages/assets/",
  "pages/main/assets/",
];

/**
 * Resolves a configured theme.stylesheet path to its actual distribution path.
 */
export function resolveThemeStylesheetHref(stylesheet: string): string {
  for (const prefix of FLATTENED_STYLESHEET_PREFIXES) {
    if (stylesheet.startsWith(prefix)) {
      return stylesheet.slice(prefix.length);
    }
  }
  return stylesheet;
}

/**
 * Generates an optional `<link rel="stylesheet">` tag for the preview iframe
 * only when a theme stylesheet is explicitly configured in site configuration.
 * When not configured, returns an empty string to avoid 404 requests.
 */
export function getIframeThemeStylesheetLink(siteConfig?: unknown): string {
  let stylesheet: string | undefined;

  if (siteConfig && typeof siteConfig === "object") {
    const rawTheme = (siteConfig as { theme?: { stylesheet?: unknown } }).theme;
    if (
      typeof rawTheme?.stylesheet === "string" &&
      rawTheme.stylesheet.trim()
    ) {
      stylesheet = rawTheme.stylesheet.trim();
    }
  } else if (typeof document !== "undefined") {
    const configScript = document.getElementById("shadow-claw-site-config");
    if (configScript?.textContent) {
      try {
        const config = JSON.parse(configScript.textContent);
        const rawTheme = config?.theme;
        if (
          typeof rawTheme?.stylesheet === "string" &&
          rawTheme.stylesheet.trim()
        ) {
          stylesheet = rawTheme.stylesheet.trim();
        }
      } catch {}
    }
  }

  if (!stylesheet) {
    return "";
  }

  const isExternal =
    stylesheet.startsWith("http://") ||
    stylesheet.startsWith("https://") ||
    stylesheet.startsWith("//");

  if (isExternal) {
    return `<link rel="stylesheet" href="${stylesheet}">`;
  }

  const resolvedHref = resolveThemeStylesheetHref(stylesheet);
  const normalizedPath = resolvedHref.startsWith("/")
    ? resolvedHref
    : `/${resolvedHref}`;

  return `<link rel="stylesheet" href="${applyBasePath(normalizedPath)}">`;
}

/**
 * Generates the CSS style block and html root class for sandboxed preview iframes
 * (file viewer and pages HTML preview) to synchronize theme CSS variables,
 * fonts, link styling, and dark/light mode color-scheme without FOUC.
 */
export function getIframeThemeStyleHtml(): string {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark-mode");
  const customProperties: string[] = [];

  if (typeof document !== "undefined") {
    const styles = getComputedStyle(document.documentElement);
    for (let i = 0; i < styles.length; i++) {
      const prop = styles[i];
      if (prop.startsWith("--")) {
        customProperties.push(`${prop}: ${styles.getPropertyValue(prop)};`);
      }
    }
  }

  return [
    "<style>",
    "  :root {",
    `    color-scheme: ${isDark ? "dark" : "light"};`,
    `    overflow: hidden;`,
    `    line-height: 1.5;`,
    `    ${customProperties.join("\n    ")}`,
    "  }",
    "  * {",
    "    scrollbar-width: thin;",
    "    scrollbar-color: var(--shadow-claw-border-color) transparent;",
    "  }",
    "  ::-webkit-scrollbar {",
    "    height: 0.5rem;",
    "    width: 0.5rem;",
    "  }",
    "  ::-webkit-scrollbar-track {",
    "    background: transparent;",
    "  }",
    "  ::-webkit-scrollbar-thumb {",
    "    background: var(--shadow-claw-border-color);",
    "    border-radius: 0.25rem;",
    "  }",
    "  ::-webkit-scrollbar-thumb:hover {",
    "    background: var(--shadow-claw-text-tertiary);",
    "  }",
    "  body {",
    "    color: var(--shadow-claw-text-primary);",
    "    background-color: var(--shadow-claw-bg-primary);",
    "    font-family: var(--shadow-claw-font-sans);",
    "    margin: 0;",
    "  }",
    "  pre, code, kbd, samp {",
    "    font-family: var(--shadow-claw-font-mono);",
    "  }",
    "  a {",
    "    color: var(--shadow-claw-link);",
    "    text-decoration: underline;",
    "    text-underline-offset: 0.125rem;",
    "  }",
    "  a:hover {",
    "    color: var(--shadow-claw-link-hover);",
    "  }",
    "  img {",
    "    max-width: 100%;",
    "    height: auto;",
    "  }",
    "  ul {",
    "    line-height: 1.5;",
    "  }",
    "  article {",
    "    padding: 1rem 1.5rem 1rem 1rem;",
    "  }",
    "  article > h1, article > h2 {",
    "    margin-top: 0;",
    "  }",
    "</style>",
  ].join("\n");
}

export function getIframeHtmlClass(): string {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark-mode");

  return isDark ? "dark-mode" : "light-mode";
}
