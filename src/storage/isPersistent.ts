/**
 * Check if the current storage is persistent.
 */
export async function isPersistent(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persisted) {
    return navigator.storage.persisted();
  }

  return false;
}
