/**
 * Get storage usage estimate.
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
}> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      navigator.storage.estimate
    ) {
      const estimate = await navigator.storage.estimate();

      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
  } catch (err) {
    console.warn("Failed to get storage estimate:", err);
  }

  return { usage: 0, quota: 0 };
}
