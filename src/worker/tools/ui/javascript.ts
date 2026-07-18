import { ShadowClawDatabase } from "../../../db/types.js";
import { sandboxedEval } from "../../sandboxedEval.js";
import { getAllowFullInternetAccess } from "./utils/getAllowFullInternetAccess.js";

export async function executeJavascript(
  db: ShadowClawDatabase,
  input: Record<string, any>,
): Promise<string> {
  const allowFullInternetAccess = await getAllowFullInternetAccess(db);
  const result = (await sandboxedEval(
    input.code,
    undefined,
    allowFullInternetAccess,
  )) as any;

  if (!result.ok) {
    return `JavaScript error: ${result.error}`;
  }

  const value = result.value;

  if (value === "__UNDEFINED__" || value === undefined) {
    return "(no return value)\nHint: Your code did not return a value. Use `return <expression>` as the last statement to see output.";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      /* fall through */
    }
  }

  return String(value);
}
