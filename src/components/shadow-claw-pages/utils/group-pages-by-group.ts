import type { SavedPageRef } from "../../../db/types.js";

/**
 * Groups an array of saved page references by their target group ID.
 */
export function groupPagesByGroup(
  pages: SavedPageRef[] = [],
): Map<string, SavedPageRef[]> {
  const pagesByGroup = new Map<string, SavedPageRef[]>();

  pages.forEach((page) => {
    const groupPages = pagesByGroup.get(page.groupId) || [];
    groupPages.push(page);
    pagesByGroup.set(page.groupId, groupPages);
  });

  return pagesByGroup;
}
