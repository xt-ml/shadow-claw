/**
 * Get storage usage estimate.
 *
 * @returns {Promise<{usage: number; quota: number}>}
 */
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();

    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }

  return { usage: 0, quota: 0 };
}
