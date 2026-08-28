import type { SavedPageRef } from "../../../db/types.js";

/**
 * Updates an accessibility live announcer element text when page navigation occurs.
 */
export function announcePageChange(
  page: SavedPageRef,
  frontmatterTitle: string | null | undefined,
  announcerEl: HTMLElement | null | undefined,
): void {
  if (!announcerEl) {
    return;
  }

  const title = frontmatterTitle || page.path;
  announcerEl.textContent = `Navigated to page: ${title}`;
}
