import {
  getFileRouteDirPath,
  getWorkspaceRouteRequestPath,
  resolveHrefAgainstRoute,
} from "../../../core/app-routes.js";
import { routeGroupMatches } from "./routeGroupMatches.js";

/**
 * Resolves a workspace relative link or route candidate to its canonical target path within a given group.
 */
export function resolveWorkspaceLinkPath(
  href: string,
  filePath: string,
  groupId: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const rawPath = trimmed.split(/[?#]/, 1)[0];
  const normalizedRoutePath = rawPath.replace(/^(?:\.\/)+/u, "");
  const routeCandidates: string[] = [];

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
    if (route && routeGroupMatches(route.groupId, groupId)) {
      return route.path;
    }
  }

  const routeDir = getFileRouteDirPath(groupId, filePath);
  const resolved = resolveHrefAgainstRoute(
    trimmed,
    routeDir,
    origin || (typeof window !== "undefined" ? window.location.origin : ""),
  );
  if (!resolved || (origin && resolved.origin !== origin)) {
    return null;
  }

  const route = getWorkspaceRouteRequestPath(resolved.pathname);
  if (!route || !routeGroupMatches(route.groupId, groupId)) {
    return null;
  }

  return route.path;
}
