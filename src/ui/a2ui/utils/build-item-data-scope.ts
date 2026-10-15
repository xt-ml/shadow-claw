/**
 * Build a per-item data scope for a data-driven child.
 *
 * Merges the surface data model with `@index` (item index) and `@item` (item
 * value) so template components can bind to them via `{ "path": "/@index" }`
 * and `{ "path": "/@item" }`. This implements spec §builtins / §@index.
 *
 * @param dataModel  The current surface data model.
 * @param item       The individual item value from the list.
 * @param index      The zero-based index of the item.
 */
export function buildItemDataScope(
  dataModel: Record<string, unknown>,
  item: unknown,
  index: number,
): Record<string, unknown> {
  return {
    ...dataModel,
    ...(typeof item === "object" && item !== null ? item : {}),
    "@index": index,
    "@item": item,
  };
}
