import {
  isPossibleAppRoute,
  resolveHrefAgainstRoute,
} from "../../../core/app-routes.js";
import { resolveWorkspaceLinkPath } from "./resolveWorkspaceLinkPath.js";

/**
 * Rewrites internal links, scripts, and media source attributes in preview HTML
 * so that relative asset references correctly target workspace route endpoints.
 */
export function rewriteWorkspacePreviewHtml(
  html: string,
  filePath: string,
  routeDir: string,
  groupId: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
): string {
  if (!html) {
    return html;
  }

  const effectiveOrigin =
    origin || (typeof window !== "undefined" ? window.location.origin : "");
  const parsed = new DOMParser().parseFromString(html, "text/html");

  const rewrite = (selector: string, attribute: "href" | "src") => {
    const nodes = Array.from(parsed.querySelectorAll(selector));
    for (const node of nodes) {
      const currentValue = node.getAttribute(attribute) || "";
      const trimmed = currentValue.trim();
      if (
        !trimmed ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("javascript:")
      ) {
        continue;
      }

      const resolved = resolveHrefAgainstRoute(
        trimmed,
        routeDir,
        effectiveOrigin,
      );
      if (
        !resolved ||
        (effectiveOrigin && resolved.origin !== effectiveOrigin)
      ) {
        continue;
      }

      if (attribute === "href") {
        const isInternal =
          isPossibleAppRoute(resolved.pathname) ||
          Boolean(
            resolveWorkspaceLinkPath(
              trimmed,
              filePath,
              groupId,
              effectiveOrigin,
            ),
          );
        if (!isInternal) {
          continue;
        }
      }

      node.setAttribute(
        attribute,
        `${resolved.pathname}${resolved.search}${resolved.hash}`,
      );
    }
  };

  rewrite("a[href]", "href");
  rewrite("img[src]", "src");
  rewrite("audio[src]", "src");
  rewrite("video[src]", "src");
  rewrite("source[src]", "src");

  return parsed.body.innerHTML;
}
