/**
 * Generate the cache key for chunk number `index` of a model.
 */
export function chunkKey(url: string, index: number): string {
  return `${url}?__sc_chunk=${index}`;
}
