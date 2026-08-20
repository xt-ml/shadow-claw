import DOMPurify from "dompurify";
import { CONFIG_KEYS } from "../config/config.js";
import { getDb } from "../db/db.js";
import { getConfig } from "../db/getConfig.js";

export const DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS: string[] = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "xt-ml.github.io",
  "kherrick.github.io",
];

let activePatterns: string[] = [...DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS];
let activeMatchers: Array<(hostname: string) => boolean> = [];

function rebuildMatchers(patterns: string[]): void {
  activeMatchers = patterns
    .map((p) => parseHostPatternMatch(p))
    .filter(Boolean);
}

rebuildMatchers(activePatterns);

/**
 * Parse a user pattern (domain name, wildcard, or regex) into a matcher function.
 */
export function parseHostPatternMatch(
  patternStr: string,
): (hostname: string) => boolean {
  const trimmed = patternStr.trim();
  if (!trimmed) {
    return () => false;
  }

  // Regex format: /pattern/flags
  if (
    trimmed.startsWith("/") &&
    (trimmed.endsWith("/") || /\/[gimuy]*$/.test(trimmed))
  ) {
    try {
      const lastSlash = trimmed.lastIndexOf("/");
      const pattern = trimmed.slice(1, lastSlash);
      const flags = trimmed.slice(lastSlash + 1);

      const re = new RegExp(pattern, flags || "i");

      return (h: string) => re.test(h);
    } catch {
      // Fall back to plain string matching if regex is invalid
    }
  }

  // Regex format without slashes (starts with ^ or ends with $)
  if (
    trimmed.includes("^") ||
    trimmed.includes("$") ||
    (trimmed.includes("(") && trimmed.includes(")"))
  ) {
    try {
      const re = new RegExp(trimmed, "i");

      return (h: string) => re.test(h);
    } catch {
      // Fall back
    }
  }

  // Wildcard format: *.domain.com
  if (trimmed.startsWith("*.")) {
    const domain = trimmed.slice(2).toLowerCase();

    return (h: string) => {
      const lh = h.toLowerCase();

      return lh === domain || lh.endsWith("." + domain);
    };
  }

  // Standard domain format (e.g. youtube.com or xt-ml.github.io)
  const domain = trimmed.toLowerCase();

  return (h: string) => {
    const lh = h.toLowerCase();

    return lh === domain || lh.endsWith("." + domain);
  };
}

/**
 * Set the allowed iframe host patterns directly in memory.
 */
export function setAllowedIframeHostPatterns(
  patterns: string[] | string,
): void {
  let list: string[];
  if (typeof patterns === "string") {
    list = patterns
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else {
    list = patterns.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  activePatterns =
    list.length > 0 ? list : [...DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS];
  rebuildMatchers(activePatterns);
}

/**
 * Get the currently active allowed iframe host pattern strings.
 */
export function getAllowedIframeHostPatterns(): string[] {
  return [...activePatterns];
}

/**
 * Load allowed iframe host patterns from IndexedDB config if available.
 */
export async function loadAllowedIframeHostPatternsFromDb(
  db?: any,
): Promise<string[]> {
  try {
    const targetDb = db || (await getDb());
    if (!targetDb) {
      return getAllowedIframeHostPatterns();
    }

    const raw = await getConfig(
      targetDb,
      CONFIG_KEYS.ALLOWED_IFRAME_HOST_PATTERNS,
    );

    if (typeof raw === "string" && raw.trim().length > 0) {
      setAllowedIframeHostPatterns(raw);
    }

    return getAllowedIframeHostPatterns();
  } catch {
    return getAllowedIframeHostPatterns();
  }
}

/**
 * Validate whether an iframe src URL points to a safe embed host or same-origin URL.
 */
export function isSafeIframeSource(src: string): boolean {
  if (!src || typeof src !== "string") {
    return false;
  }

  const trimmed = src.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
    return false;
  }

  try {
    const base =
      typeof window !== "undefined" &&
      window.location?.origin &&
      window.location.origin !== "null"
        ? window.location.origin
        : "http://localhost";
    const url = new URL(trimmed, base);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    if (
      typeof window !== "undefined" &&
      window.location?.origin &&
      window.location.origin !== "null" &&
      url.origin === window.location.origin
    ) {
      return true;
    }

    return activeMatchers.some((matcher) => matcher(url.hostname));
  } catch {
    return false;
  }
}

let domPurifyInstance: any = null;

/**
 * Get the shared DOMPurify instance across environments.
 */
export function getDOMPurify(): any {
  if (domPurifyInstance && domPurifyInstance.isSupported !== false) {
    return domPurifyInstance;
  }

  const p = DOMPurify as any;
  const win =
    typeof window !== "undefined"
      ? window
      : typeof globalThis !== "undefined" && (globalThis as any).window
        ? (globalThis as any).window
        : undefined;

  let instance: any = null;
  if (typeof p === "function") {
    instance = win ? p(win) : p();
  } else if (typeof p?.default === "function") {
    instance = win ? p.default(win) : p.default();
  } else if (typeof p?.addHook === "function") {
    instance = p;
  } else if (typeof p?.default?.addHook === "function") {
    instance = p.default;
  } else {
    instance = p;
  }

  if (instance && typeof instance.addHook === "function") {
    domPurifyInstance = instance;
  } else {
    domPurifyInstance = instance || p;
  }

  return domPurifyInstance;
}

let hookRegistered = false;

/**
 * Ensures DOMPurify has the iframe sanitization hook registered.
 */
export function ensureIframeSanitizerHook(): void {
  if (hookRegistered) {
    return;
  }

  const purify = getDOMPurify();
  if (purify && typeof purify.addHook === "function") {
    const sanitizeIframeNode = (node: Node) => {
      if (
        node &&
        node.nodeType === 1 &&
        (node as Element).tagName?.toLowerCase() === "iframe"
      ) {
        const el = node as Element;
        const src = el.getAttribute("src") || "";
        if (!src || !isSafeIframeSource(src)) {
          el.removeAttribute("src");
          if (typeof el.remove === "function") {
            el.remove();
          }
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } else if (!el.hasAttribute("referrerpolicy")) {
          el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        }
      }
    };

    purify.addHook("uponSanitizeElement", sanitizeIframeNode);
    purify.addHook("afterSanitizeElements", sanitizeIframeNode);

    hookRegistered = true;
  }
}
