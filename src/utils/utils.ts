/// <reference lib="dom" />
import type { Config } from "dompurify";
import { parseRouteFromUrl } from "../core/app-routes.js";
import {
  ensureIframeSanitizerHook,
  getDOMPurify,
} from "../security/iframe-sanitizer.js";
import {
  ensureCustomElementSanitizerHook,
  isAllowedCustomElement,
} from "../security/custom-element-security.js";

/**
 * Sanitize HTML content using DOMPurify, allowing custom element tags.
 */
export function sanitizeHtml(
  dirty: string | Node = "",
  options: Config = {},
): string {
  ensureIframeSanitizerHook();
  ensureCustomElementSanitizerHook();

  return getDOMPurify().sanitize(dirty, {
    ADD_TAGS: ["iframe", "figure", "figcaption"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "scrolling",
      "referrerpolicy",
      "loading",
    ],
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: (tagName: string) => isAllowedCustomElement(tagName),
      attributeNameCheck: () => true,
      allowCustomizedBuiltInElements: false,
    },
    ...options,
  });
}

/**
 * Interface representing the detailed internal navigation parameters
 */
export interface ShadowClawNavigateDetail {
  page: string;
  groupId?: string;
  path?: string;
  anchor?: string;
}

/**
 * Parses a special or relative link and dispatches the 'shadow-claw-navigate' custom event on document.
 * Returns true if the link was handled/intercepted, false otherwise.
 */
export function handleSpecialLinkNavigation(
  href: string,
  basePath: string = "",
  currentGroupId?: string,
): boolean {
  let trimmed = href.trim();
  if (!trimmed) {
    return false;
  }

  // Handle malformed query strings where '?' is used instead of '&' (e.g. #Page?param1=val1?param2=val2)
  const firstQuestion = trimmed.indexOf("?");
  if (firstQuestion !== -1) {
    const before = trimmed.slice(0, firstQuestion + 1);
    const after = trimmed.slice(firstQuestion + 1);
    trimmed = before + after.replace(/\?/g, "&");
  }

  // 1. Check if it is a case-insensitive special link starting with "/#" or "#" matching standard pages
  if (trimmed.startsWith("/#") || trimmed.startsWith("#")) {
    const withoutHash = trimmed.startsWith("/#")
      ? trimmed.slice(2)
      : trimmed.slice(1);

    // Parse parts: Page?query#anchor
    const pagePart = withoutHash.split(/[?#]/, 1)[0];
    const pageName = pagePart.toLowerCase();

    // Valid pages
    const validPages = ["chat", "files", "tasks", "pages", "settings"];
    if (validPages.includes(pageName)) {
      // Create a dummy absolute URL to parse searchParams easily
      const fakeUrl = trimmed.startsWith("/#")
        ? trimmed.replace(/^\/#/, "http://local/")
        : trimmed.replace(/^#/, "http://local/");
      const urlLike = new URL(fakeUrl, "http://local/");

      const groupId =
        urlLike.searchParams.get("groupId") ||
        urlLike.searchParams.get("conversationId") ||
        currentGroupId;
      const path =
        urlLike.searchParams.get("file") ||
        urlLike.searchParams.get("path") ||
        undefined;
      // Support: ?anchor=some-heading, ?anchor=L10-L20, or #fragment
      const anchorParam = urlLike.searchParams.get("anchor");
      const anchor = anchorParam
        ? anchorParam
        : urlLike.hash
          ? urlLike.hash.slice(1)
          : undefined;

      const detail: ShadowClawNavigateDetail = {
        page: pageName,
        groupId: groupId || undefined,
        path: path || undefined,
        anchor: anchor || undefined,
      };

      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail,
          bubbles: true,
          composed: true,
        }),
      );

      return true;
    }
  }

  // 1.5. Check if it is an absolute application route (e.g., /files/room:123/path, /chat/...)
  if (trimmed.startsWith("/")) {
    try {
      const urlLike = new URL(trimmed, window.location.origin);
      const route = parseRouteFromUrl(urlLike, currentGroupId);
      if (route) {
        document.dispatchEvent(
          new CustomEvent("shadow-claw-navigate", {
            detail: {
              page: route.page,
              groupId: route.groupId,
              path: route.path,
              anchor:
                route.anchor ||
                (urlLike.hash ? urlLike.hash.slice(1) : undefined),
            },
            bubbles: true,
            composed: true,
          }),
        );

        return true;
      }
    } catch {
      // Fallback to relative workspace path resolution below
    }
  }

  // 2. Relative or absolute workspace paths, e.g., "docs/README.md"
  // If it does not have a scheme (http, https, mailto, etc.) and is not external:
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
  if (
    !hasScheme &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("javascript:")
  ) {
    // Resolve absolute vs relative
    let resolvedPath = trimmed.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    const isAbsolute = resolvedPath.startsWith("/");
    resolvedPath = resolvedPath.replace(/^\/+/, "");

    const urlLike = new URL(trimmed, "http://local/");
    const anchor = urlLike.hash ? urlLike.hash.slice(1) : undefined;

    let finalPath = resolvedPath;
    if (!isAbsolute && basePath) {
      const baseParts = basePath
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .split("/")
        .filter(Boolean);
      baseParts.pop(); // Remove the filename of base path

      const pathParts = resolvedPath.split("/");
      const stack = [...baseParts];
      for (const part of pathParts) {
        if (!part || part === ".") {
          continue;
        }

        if (part === "..") {
          stack.pop();
        } else {
          stack.push(part);
        }
      }

      finalPath = stack.join("/");
    }

    if (finalPath) {
      const detail: ShadowClawNavigateDetail = {
        page: "files",
        groupId: currentGroupId || undefined,
        path: finalPath,
        anchor: anchor || undefined,
      };

      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail,
          bubbles: true,
          composed: true,
        }),
      );

      return true;
    }
  }

  return false;
}
