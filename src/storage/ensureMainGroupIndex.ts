/// <reference lib="dom" />
import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../config/config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { DEFAULT_MAIN_GROUP_INDEX_CONTENT } from "./defaultIndexContent.mjs";
import { groupFileExists } from "./groupFileExists.js";
import { writeGroupFile } from "./writeGroupFile.js";

import { applyBasePath } from "../core/app-routes.js";

import type { ShadowClawDatabase } from "../db/types.js";

export const DEFAULT_MAIN_GROUP_INDEX_PATH = "index.html";
export const STATIC_MAIN_GROUP_INDEX_PATH = "static-main/index.html";

export function resolveStaticMainGroupIndexUrl(): string {
  const targetPath = applyBasePath(`/${STATIC_MAIN_GROUP_INDEX_PATH}`);

  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      return new URL(targetPath, window.location.origin).toString();
    } catch {
      return targetPath;
    }
  }

  return targetPath;
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
  customContent?: string,
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

    let content = customContent;
    if (content === undefined && typeof fetch === "function") {
      try {
        const res = await fetch(resolveStaticMainGroupIndexUrl());
        if (res.ok) {
          content = await res.text();
        }
      } catch {
        // Fetch failed or unavailable, fallback to default
      }
    }
    content = content ?? DEFAULT_MAIN_GROUP_INDEX_CONTENT;

    await writeGroupFile(db, groupId, "index.html", content);

    return true;
  } catch (error) {
    console.warn("Failed to ensure main workspace Memory:", error);

    return false;
  }
}
