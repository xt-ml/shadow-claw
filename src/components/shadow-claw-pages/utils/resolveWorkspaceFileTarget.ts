import { getWorkspaceRouteRequestPath } from "../../../core/app-routes.js";
import { resolveRouteGroupId } from "./resolveRouteGroupId.js";
import { resolveWorkspaceLinkPath } from "./resolveWorkspaceLinkPath.js";

/**
 * Resolves an arbitrary href from a workspace preview page to its target group ID and path.
 */
export function resolveWorkspaceFileTarget(
  href: string,
  filePath: string,
  groupId: string,
  groups: Array<{ groupId: string }> = [],
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
): { groupId: string; path: string } | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const routeCandidates: string[] = [];
  let rawPath = trimmed.split(/[?#]/, 1)[0];

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(rawPath) || rawPath.startsWith("//")) {
    let parsed: URL;
    try {
      parsed = new URL(
        rawPath,
        origin || (typeof window !== "undefined" ? window.location.origin : ""),
      );
    } catch {
      return null;
    }

    if (origin && parsed.origin !== origin) {
      return null;
    }

    rawPath = parsed.pathname;
  }

  const normalizedRoutePath = rawPath.replace(/^(?:\.\/)+/u, "");
  if (normalizedRoutePath.startsWith("files/")) {
    routeCandidates.push(`/${normalizedRoutePath}`);
  }

  if (rawPath.startsWith("/")) {
    const nestedFilesIndex = rawPath.lastIndexOf("/files/");
    if (nestedFilesIndex > 0) {
      routeCandidates.push(rawPath.slice(nestedFilesIndex));
    }

    routeCandidates.push(rawPath);
  }

  for (const candidate of routeCandidates) {
    const route = getWorkspaceRouteRequestPath(candidate);
    if (!route) {
      continue;
    }

    const resolvedGroupId = resolveRouteGroupId(route.groupId, groupId, groups);
    if (!resolvedGroupId) {
      continue;
    }

    return { groupId: resolvedGroupId, path: route.path };
  }

  const path = resolveWorkspaceLinkPath(trimmed, filePath, groupId, origin);
  if (!path) {
    return null;
  }

  return { groupId, path };
}
