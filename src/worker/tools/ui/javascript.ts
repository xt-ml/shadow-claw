import { ShadowClawDatabase } from "../../../db/types.js";
import { sandboxedEval } from "../../utils/sandboxedEval.js";
import { getAllowFullInternetAccess } from "./utils/getAllowFullInternetAccess.js";

export async function executeJavascript(
  db: ShadowClawDatabase,
  input: Record<string, any>,
): Promise<string> {
  const allowFullInternetAccess = await getAllowFullInternetAccess(db);
  let codeToRun = input.code;
  if (typeof codeToRun === "string" && !/\breturn\b/.test(codeToRun)) {
    codeToRun = `return (${codeToRun.trim()});`;
  }

  let result = (await sandboxedEval(
    codeToRun,
    undefined,
    allowFullInternetAccess,
    input.data,
  )) as any;

  const isSyntaxOrMissingResult =
    !result ||
    (typeof result.error === "string" &&
      (result.error.includes("SyntaxError") ||
        result.error.includes("Unexpected token") ||
        result.error.includes("illegal statement")));

  if (isSyntaxOrMissingResult && codeToRun !== input.code) {
    result = (await sandboxedEval(
      input.code,
      undefined,
      allowFullInternetAccess,
      input.data,
    )) as any;
  }

  if (!result || !result.ok) {
    return `JavaScript error: ${result?.error || "Unknown error"}`;
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
