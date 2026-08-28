/**
 * Compares two group IDs for route matching, taking into account
 * group aliases (such as 'main' vs 'br:main') and colon normalization.
 */
export function routeGroupMatches(
  routeGroupId: string,
  expectedGroupId: string,
): boolean {
  if (routeGroupId === expectedGroupId) {
    return true;
  }

  if (
    (routeGroupId === "main" && expectedGroupId === "br:main") ||
    (routeGroupId === "br:main" && expectedGroupId === "main")
  ) {
    return true;
  }

  if (!routeGroupId.includes(":") && !expectedGroupId.includes(":")) {
    return false;
  }

  const normalize = (value: string) => value.trim().replace(/:/g, "-");

  return normalize(routeGroupId) === normalize(expectedGroupId);
}
