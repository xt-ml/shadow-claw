import type { ShadowClawDatabase } from "../../../db/types.js";
import { getConfig } from "../../../db/get-config.js";
import { isTruthyConfigValue } from "../../../utils/parse-boolean-config.js";

/**
 * Resolves a frontmatter toggle configuration boolean from database with fallback.
 */
export async function resolveFrontmatterToggle(
  db: ShadowClawDatabase | null,
  key: string,
  getConfigFn: typeof getConfig = getConfig,
): Promise<boolean> {
  if (!db || typeof (db as any).transaction !== "function") {
    return true;
  }

  try {
    return isTruthyConfigValue(await getConfigFn(db, key), true);
  } catch {
    return true;
  }
}
