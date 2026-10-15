/**
 * Check if the browser Cache Storage API is available.
 */
export function isCacheStorageAvailable(): boolean {
  return typeof caches !== "undefined" && typeof caches.open === "function";
}
