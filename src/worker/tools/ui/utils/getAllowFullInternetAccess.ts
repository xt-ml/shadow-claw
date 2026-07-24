import { CONFIG_KEYS } from "../../../../config/config";

import { getConfig } from "../../../../db/getConfig";
import { ShadowClawDatabase } from "../../../../db/types";

import { parseBooleanConfig } from "../../bash/utils/parseBooleanConfig";

export async function getAllowFullInternetAccess(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const configuredInternetAccess = parseBooleanConfig(
    await getConfig(db, CONFIG_KEYS.VM_BASH_FULL_INTERNET_ACCESS),
  );

  return configuredInternetAccess ?? false;
}
