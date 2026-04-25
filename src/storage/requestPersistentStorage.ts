/**
 * Request persistent storage so the browser doesn't evict our data.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist();
  }

  return false;
}
