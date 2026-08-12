/**
 * Check if the current storage is persistent.
 */
export async function isPersistent(): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      navigator.storage.persisted
    ) {
      return await navigator.storage.persisted();
    }
  } catch (err) {
    console.warn("Failed to check persistent storage:", err);
  }

  return false;
}
