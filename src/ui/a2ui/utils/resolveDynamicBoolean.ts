import { globalFunctionRegistry } from "../registries/FunctionRegistry.js";
import { resolveJsonPointer } from "./resolveJsonPointer.js";

import type {
  DataModelRef,
  DynamicBoolean,
  FunctionCall,
  PathRef,
} from "../types.js";

/**
 * Resolve a dynamic boolean against a data model.
 */
export function resolveDynamicBoolean(
  value: DynamicBoolean | undefined | null,
  dataModel: Record<string, unknown>,
): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "object" && "path" in value) {
    return Boolean(resolveJsonPointer(dataModel, (value as PathRef).path));
  }
  if (typeof value === "object" && "$dataModel" in value) {
    return Boolean(
      resolveJsonPointer(dataModel, (value as DataModelRef).$dataModel),
    );
  }

  if (typeof value === "object" && "call" in value) {
    const fc = value as FunctionCall;
    try {
      return Boolean(
        globalFunctionRegistry.execute(fc.call, fc.args ?? {}, { dataModel }),
      );
    } catch (err) {
      console.warn(`[resolveDynamicBoolean] Function evaluation failed:`, err);
      return false;
    }
  }

  return false;
}
