/**
 * Request persistent storage so the browser doesn't evict our data.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      navigator.storage.persist
    ) {
      return await navigator.storage.persist();
    }
  } catch (err) {
    console.warn("Failed to request persistent storage:", err);
  }

  return false;
}
