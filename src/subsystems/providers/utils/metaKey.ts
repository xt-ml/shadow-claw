/**
 * Generate the cache key for a model's JSON metadata entry.
 */
export function metaKey(url: string): string {
  return `${url}?__sc_meta=1`;
}
