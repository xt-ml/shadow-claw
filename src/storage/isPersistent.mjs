/**
 * Check if the current storage is persistent.
 *
 * @returns {Promise<boolean>}
 */
export async function isPersistent() {
  if (navigator.storage && navigator.storage.persisted) {
    return navigator.storage.persisted();
  }

  return false;
}
