/**
 * Set a value at a JSON Pointer path in a plain object (write).
 * Creates intermediate objects as needed.
 * @internal
 */
function setAtPointer(
  obj: Record<string, unknown>,
  pointer: string,
  value: unknown,
  remove: boolean,
): Record<string, unknown> {
  const tokens = pointer
    .replace(/^\//, "")
    .split("/")
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"))
    .filter((t) => t !== "");

  if (tokens.length === 0) {
    // "/" — replace entire object
    return typeof value === "object" && value !== null
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  if (tokens.length === 1) {
    const next = { ...obj };
    if (remove) {
      delete next[tokens[0]];
    } else {
      next[tokens[0]] = value;
    }
    return next;
  }

  // Deep path — recurse
  const [head, ...rest] = tokens;
  const child =
    obj[head] != null && typeof obj[head] === "object"
      ? { ...(obj[head] as Record<string, unknown>) }
      : {};
  return {
    ...obj,
    [head]: setAtPointer(child, "/" + rest.join("/"), value, remove),
  };
}

/**
 * Apply a single A2UI v1.0 `updateDataModel` operation to a data model.
 *
 * - `path` defaults to `"/"` (replace the entire data model).
 * - If `value` is `undefined` and `hasValue` is `false`, the key at `path`
 *   is deleted.
 *
 * @param dataModel The current data model.
 * @param path      JSON Pointer path (RFC 6901). Defaults to `"/"`.
 * @param value     The new value to set.
 * @param hasValue  Pass `false` when the caller explicitly omits `value` to
 *                  trigger key deletion rather than setting `undefined`.
 */
export function applyDataModelUpdate(
  dataModel: Record<string, unknown>,
  path?: string,
  value?: unknown,
  hasValue = true,
): Record<string, unknown> {
  const p = path ?? "/";

  if (p === "/" || p === "") {
    // Replace entire data model
    if (hasValue && typeof value === "object" && value !== null) {
      return { ...(value as Record<string, unknown>) };
    }
    return {};
  }

  return setAtPointer(dataModel, p, value, !hasValue || value === undefined);
}

export function applyDataModelPatches(
  dataModel: Record<string, unknown>,
  patches: Record<string, unknown>,
): Record<string, unknown> {
  let next = { ...dataModel };
  for (const [pointer, value] of Object.entries(patches)) {
    next = applyDataModelUpdate(next, pointer, value);
  }
  return next;
}
