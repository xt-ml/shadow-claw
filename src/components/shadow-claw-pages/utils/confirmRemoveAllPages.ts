import type { ShadowClawDatabase } from "../../../db/types.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";

/**
 * Prompts user confirmation before purging all pages from IndexedDB via orchestratorStore.
 */
export async function confirmRemoveAllPages(
  db: ShadowClawDatabase | null,
  requestConfirmationFn: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>,
  removeAllFn: (db: ShadowClawDatabase) => Promise<void> = (database) =>
    orchestratorStore.removeAllPages(database),
): Promise<boolean> {
  if (!db) {
    return false;
  }

  const confirmed = await requestConfirmationFn({
    title: "Remove All Pages",
    message: "Remove ALL saved pages from Pages? This cannot be undone!",
    confirmLabel: "Remove All",
    cancelLabel: "Cancel",
  });

  if (!confirmed) {
    return false;
  }

  await removeAllFn(db);
  return true;
}
