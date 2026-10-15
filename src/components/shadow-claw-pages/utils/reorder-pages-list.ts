/**
 * Reorders an element in an array from `fromIndex` to `toIndex`.
 * Returns a new array with the item moved, or the original array if indices are invalid/unchanged.
 */
export function reorderPagesList<T>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length
  ) {
    return items;
  }

  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}
