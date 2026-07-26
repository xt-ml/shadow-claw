import { resolveJsonPointer } from "./resolveJsonPointer.js";

import type { DataModelRef, DynamicNumber, PathRef } from "../types.js";

/**
 * Resolve a dynamic number against a data model.
 */
export function resolveDynamicNumber(
  value: DynamicNumber | undefined | null,
  dataModel: Record<string, unknown>,
): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "path" in value) {
    return Number(resolveJsonPointer(dataModel, (value as PathRef).path) ?? 0);
  }
  if (typeof value === "object" && "$dataModel" in value) {
    return Number(
      resolveJsonPointer(dataModel, (value as DataModelRef).$dataModel) ?? 0,
    );
  }
  return 0;
}
