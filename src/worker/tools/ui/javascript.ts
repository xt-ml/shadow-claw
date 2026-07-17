import { getConfig } from "../../../db/getConfig.js";
import { CONFIG_KEYS } from "../../../config/config.js";
import { ShadowClawDatabase } from "../../../db/types.js";
import { sandboxedEval } from "../../sandboxedEval.js";

function parseBooleanConfig(value: string | null | undefined): boolean | null {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

async function getAllowFullInternetAccess(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const configuredInternetAccess = parseBooleanConfig(
    await getConfig(db, CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS),
  );

  return configuredInternetAccess ?? false;
}

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
