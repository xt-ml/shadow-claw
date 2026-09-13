import { ShadowClawDatabase } from "../../../../db/types.js";
import { parseBooleanConfig } from "./parseBooleanConfig.js";
import { getConfig } from "../../../../db/getConfig.js";
import { CONFIG_KEYS } from "../../../../config/config.js";

export async function getAllowFullInternetAccess(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const configuredInternetAccess = parseBooleanConfig(
    await getConfig(db, CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS),
  );

  return configuredInternetAccess ?? false;
}
