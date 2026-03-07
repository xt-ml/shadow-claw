/**
 * Request persistent storage so the browser doesn't evict our data.
 *
 * @returns {Promise<boolean>}
 */
export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist();
  }

  return false;
}
