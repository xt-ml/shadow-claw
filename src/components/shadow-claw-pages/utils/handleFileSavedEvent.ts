import { shouldRefreshOnFileSaved } from "./shouldRefreshOnFileSaved.js";
import type { SavedPageRef } from "../../../db/types.js";

/**
 * Handles file-saved event details and evaluates if re-render is required.
 */
export function handleFileSavedEvent(
  event: Event,
  selectedPage: SavedPageRef | null,
): boolean {
  const detail = (event as CustomEvent).detail;
  return shouldRefreshOnFileSaved(detail, selectedPage);
}
