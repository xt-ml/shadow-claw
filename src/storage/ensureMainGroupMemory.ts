/// <reference lib="dom" />
import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../config/config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { DEFAULT_MAIN_GROUP_MEMORY_CONTENT } from "./defaultMemoryContent.mjs";
import { groupFileExists } from "./groupFileExists.js";
import { writeGroupFile } from "./writeGroupFile.js";

import { applyBasePath } from "../core/app-routes.js";

import type { ShadowClawDatabase } from "../db/types.js";

export { DEFAULT_MAIN_GROUP_MEMORY_CONTENT as DEFAULT_MAIN_GROUP_MEMORY_CONTENT };

export const DEFAULT_MAIN_GROUP_MEMORY_PATH = "MEMORY.md";
export const STATIC_MAIN_GROUP_MEMORY_PATH = "static-main/MEMORY.md";

export function resolveStaticMainGroupMemoryUrl(): string {
  const targetPath = applyBasePath(`/${STATIC_MAIN_GROUP_MEMORY_PATH}`);

  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      return new URL(targetPath, window.location.origin).toString();
    } catch {
      return targetPath;
    }
  }

  return targetPath;
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
  customContent?: string,
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

    let content = customContent;
    if (content === undefined && typeof fetch === "function") {
      try {
        const res = await fetch(resolveStaticMainGroupMemoryUrl());
        if (res.ok) {
          content = await res.text();
        }
      } catch {
        // Fetch failed or unavailable, fallback to default
      }
    }
    content = content ?? DEFAULT_MAIN_GROUP_MEMORY_CONTENT;

    await writeGroupFile(db, groupId, DEFAULT_MAIN_GROUP_MEMORY_PATH, content);

    return true;
  } catch (error) {
    console.warn("Failed to ensure main workspace Memory:", error);

    return false;
  }
}
