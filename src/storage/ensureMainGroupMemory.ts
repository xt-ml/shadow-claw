/// <reference lib="dom" />
import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../config/config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { DEFAULT_MAIN_GROUP_MEMORY_CONTENT } from "./defaultMemoryContent.mjs";
import { groupFileExists } from "./groupFileExists.js";
import { writeGroupFile } from "./writeGroupFile.js";

import type { ShadowClawDatabase } from "../db/types.js";

export { DEFAULT_MAIN_GROUP_MEMORY_CONTENT as DEFAULT_MAIN_GROUP_MEMORY_CONTENT };

export const DEFAULT_MAIN_GROUP_MEMORY_PATH = "MEMORY.md";
export const STATIC_MAIN_GROUP_MEMORY_PATH = "br-main/memory.md";

export function resolveStaticMainGroupMemoryUrl(): string {
  const fallback = `/${STATIC_MAIN_GROUP_MEMORY_PATH}`;

  if (typeof document === "undefined" || !document.baseURI) {
    return fallback;
  }

  try {
    return new URL(STATIC_MAIN_GROUP_MEMORY_PATH, document.baseURI).toString();
  } catch {
    return fallback;
  }
}

export async function isMainGroupMemorySuppressed(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const raw = (await getConfig(
    db,
    CONFIG_KEYS.MAIN_GROUP_README_SUPPRESSED,
  )) as unknown;

  return raw === true || raw === "true";
}

export async function setMainGroupMemorySuppressed(
  db: ShadowClawDatabase,
  suppressed: boolean,
): Promise<void> {
  await setConfig(db, CONFIG_KEYS.MAIN_GROUP_README_SUPPRESSED, suppressed);
}

/**
 * Ensure the main MEMORY.md exists in the workspace file store.
 * Returns true if the file exists after this call (already existed or was created).
 */
export async function ensureMainGroupMemory(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
): Promise<boolean> {
  try {
    const exists = await groupFileExists(
      db,
      groupId,
      DEFAULT_MAIN_GROUP_MEMORY_PATH,
    );
    if (exists) {
      return true;
    }

    if (
      groupId === DEFAULT_GROUP_ID &&
      (await isMainGroupMemorySuppressed(db))
    ) {
      return false;
    }

    await writeGroupFile(
      db,
      groupId,
      DEFAULT_MAIN_GROUP_MEMORY_PATH,
      DEFAULT_MAIN_GROUP_MEMORY_CONTENT,
    );

    return true;
  } catch (error) {
    console.warn("Failed to ensure main workspace Memory:", error);

    return false;
  }
}
