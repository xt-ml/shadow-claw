import { globalFunctionRegistry } from "../registries/FunctionRegistry.js";
import { resolveJsonPointer } from "./resolveJsonPointer.js";

import type {
  DataModelRef,
  DynamicString,
  FunctionCall,
  PathRef,
} from "../types.js";

/**
 * Resolve a dynamic string against a data model.
 *
 * Supported forms (in priority order):
 * - Literal string: `"Hello"`
 * - Spec-canonical path ref: `{ "path": "/key" }` (A2UI v1.0)
 * - Deprecated data-model ref: `{ "$dataModel": "/key" }` (backward compat)
 * - Function call: `{ "call": "capitalize", "args": { "value": ... } }`
 */
export function resolveDynamicString(
  value: DynamicString | undefined | null,
  dataModel: Record<string, unknown>,
): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  // Spec-canonical: { "path": "/key" }
  if (typeof value === "object" && "path" in value) {
    return String(resolveJsonPointer(dataModel, (value as PathRef).path) ?? "");
  }

  // Deprecated: { "$dataModel": "/key" }
  if (typeof value === "object" && "$dataModel" in value) {
    return String(
      resolveJsonPointer(dataModel, (value as DataModelRef).$dataModel) ?? "",
    );
  }

  if (typeof value !== "object" || !("call" in value)) {
    return "";
  }

  const fc = value as FunctionCall;

  try {
    return String(
      globalFunctionRegistry.execute(fc.call, fc.args ?? {}, { dataModel }) ??
        "",
    );
  } catch (err) {
    console.warn(`[resolveDynamicString] Function evaluation failed:`, err);
    return "";
  }
}
