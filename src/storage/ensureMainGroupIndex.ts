/// <reference lib="dom" />
import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../config/config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { DEFAULT_MAIN_GROUP_INDEX_CONTENT } from "./defaultIndexContent.mjs";
import { groupFileExists } from "./groupFileExists.js";
import { writeGroupFile } from "./writeGroupFile.js";

import type { ShadowClawDatabase } from "../db/types.js";

export const DEFAULT_MAIN_GROUP_INDEX_PATH = "index.html";
export const STATIC_MAIN_GROUP_INDEX_PATH = "br-main/index.html";

export function resolveStaticMainGroupIndexUrl(): string {
  const fallback = `/${STATIC_MAIN_GROUP_INDEX_PATH}`;

  if (typeof document === "undefined" || !document.baseURI) {
    return fallback;
  }

  try {
    return new URL(STATIC_MAIN_GROUP_INDEX_PATH, document.baseURI).toString();
  } catch {
    return fallback;
  }
}

export async function isMainGroupIndexSuppressed(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const raw = (await getConfig(
    db,
    CONFIG_KEYS.MAIN_GROUP_INDEX_SUPPRESSED,
  )) as unknown;

  return raw === true || raw === "true";
}

export async function setMainGroupIndexSuppressed(
  db: ShadowClawDatabase,
  suppressed: boolean,
): Promise<void> {
  await setConfig(db, CONFIG_KEYS.MAIN_GROUP_INDEX_SUPPRESSED, suppressed);
}

/**
 * Ensure the main index.html exists in the workspace file store.
 * Returns true if the file exists after this call (already existed or was created).
 */
export async function ensureMainGroupIndex(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
): Promise<boolean> {
  try {
    const exists = await groupFileExists(db, groupId, "index.html");

    if (exists) {
      return true;
    }

    if (
      groupId === DEFAULT_GROUP_ID &&
      (await isMainGroupIndexSuppressed(db))
    ) {
      return false;
    }

    await writeGroupFile(
      db,
      groupId,
      "index.html",
      DEFAULT_MAIN_GROUP_INDEX_CONTENT,
    );

    return true;
  } catch (error) {
    console.warn("Failed to ensure main workspace Memory:", error);

    return false;
  }
}
