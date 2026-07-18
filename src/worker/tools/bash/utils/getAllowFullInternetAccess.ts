import { ShadowClawDatabase } from "../../../../db/types";
import { parseBooleanConfig } from "./parseBooleanConfig";
import { getConfig } from "../../../../db/getConfig";
import { CONFIG_KEYS } from "../../../../config/config";

export async function getAllowFullInternetAccess(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const configuredInternetAccess = parseBooleanConfig(
    await getConfig(db, CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS),
  );

  return configuredInternetAccess ?? false;
}
