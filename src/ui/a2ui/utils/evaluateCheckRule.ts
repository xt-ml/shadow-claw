import { globalFunctionRegistry } from "../registries/FunctionRegistry.js";
import { resolveDynamicString } from "./resolveDynamicString.js";

import type { CheckRule, FunctionCall } from "../types.js";

/**
 * Evaluate a check rule against the current data model.
 * Returns `null` if valid, or the error message string if invalid.
 */
export function evaluateCheckRule(
  rule: CheckRule,
  dataModel: Record<string, unknown>,
): string | null {
  const fc = rule.rule as FunctionCall;
  let valid = true;
  try {
    valid = Boolean(
      globalFunctionRegistry.execute(fc.call, fc.args ?? {}, { dataModel }),
    );
  } catch (err) {
    console.warn(`[evaluateCheckRule] Function evaluation failed:`, err);
    valid = false;
  }
  return valid ? null : resolveDynamicString(rule.errorMessage, dataModel);
}
