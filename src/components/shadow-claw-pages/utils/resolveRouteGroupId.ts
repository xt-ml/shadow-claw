import { routeGroupMatches } from "./routeGroupMatches.js";

/**
 * Resolves a target route group ID against an expected group ID and known workspace groups.
 */
export function resolveRouteGroupId(
  routeGroupId: string,
  expectedGroupId: string,
  groups: Array<{ groupId: string }> = [],
): string | null {
  if (
    routeGroupId === expectedGroupId ||
    routeGroupMatches(routeGroupId, expectedGroupId)
  ) {
    return expectedGroupId;
  }

  const exact = groups.find((group) => group.groupId === routeGroupId);
  if (exact) {
    return exact.groupId;
  }

  const alias = groups.find((group) =>
    routeGroupMatches(routeGroupId, group.groupId),
  );
  if (alias) {
    return alias.groupId;
  }

  return routeGroupId || null;
}
