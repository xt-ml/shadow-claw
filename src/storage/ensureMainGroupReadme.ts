import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../config.js";
import { getConfig } from "../db/getConfig.js";
import { groupFileExists } from "./groupFileExists.js";
import { readGroupFile } from "./readGroupFile.js";
import type { ShadowClawDatabase } from "../types.js";
import { setConfig } from "../db/setConfig.js";
import { writeGroupFile } from "./writeGroupFile.js";
import { DEFAULT_MAIN_GROUP_README_CONTENT } from "./defaultReadmeContent.mjs";

export { DEFAULT_MAIN_GROUP_README_CONTENT };

export const DEFAULT_MAIN_GROUP_README_PATH = "MEMORY.md";
export const LEGACY_MAIN_GROUP_README_PATH_ROOT = "README.md";
export const LEGACY_MAIN_GROUP_README_PATH = "main/README.md";
export const STATIC_MAIN_GROUP_README_PATH = "main/MEMORY.md";

export function resolveStaticMainGroupReadmeUrl(): string {
  const fallback = `/${STATIC_MAIN_GROUP_README_PATH}`;

  if (typeof document === "undefined" || !document.baseURI) {
    return fallback;
  }

  try {
    return new URL(STATIC_MAIN_GROUP_README_PATH, document.baseURI).toString();
  } catch {
    return fallback;
  }
}

export async function isMainGroupReadmeSuppressed(
  db: ShadowClawDatabase,
): Promise<boolean> {
  const raw = (await getConfig(
    db,
    CONFIG_KEYS.MAIN_GROUP_README_SUPPRESSED,
  )) as unknown;

  return raw === true || raw === "true";
}

export async function setMainGroupReadmeSuppressed(
  db: ShadowClawDatabase,
  suppressed: boolean,
): Promise<void> {
  await setConfig(db, CONFIG_KEYS.MAIN_GROUP_README_SUPPRESSED, suppressed);
}

/**
 * Ensure the main README exists in the workspace file store.
 * Returns true if the file exists after this call (already existed or was created).
 */
export async function ensureMainGroupReadme(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
): Promise<boolean> {
  try {
    const exists = await groupFileExists(
      db,
      groupId,
      DEFAULT_MAIN_GROUP_README_PATH,
    );
    if (exists) {
      return true;
    }

    if (
      groupId === DEFAULT_GROUP_ID &&
      (await isMainGroupReadmeSuppressed(db))
    ) {
      return false;
    }

    const hasLegacyRootReadme = await groupFileExists(
      db,
      groupId,
      LEGACY_MAIN_GROUP_README_PATH_ROOT,
    );

    const hasLegacyReadme = await groupFileExists(
      db,
      groupId,
      LEGACY_MAIN_GROUP_README_PATH,
    );

    let content = DEFAULT_MAIN_GROUP_README_CONTENT;
    if (hasLegacyRootReadme) {
      const legacyContent = await readGroupFile(
        db,
        groupId,
        LEGACY_MAIN_GROUP_README_PATH_ROOT,
      );
      if (legacyContent.trim().length > 0) {
        content = legacyContent;
      }
    } else if (hasLegacyReadme) {
      const legacyContent = await readGroupFile(
        db,
        groupId,
        LEGACY_MAIN_GROUP_README_PATH,
      );
      if (legacyContent.trim().length > 0) {
        content = legacyContent;
      }
    } else {
      try {
        const response = await fetch(resolveStaticMainGroupReadmeUrl());
        if (response.ok) {
          const templateContent = await response.text();
          if (templateContent.trim().length > 0) {
            content = templateContent;
          }
        }
      } catch {
        // Fallback to embedded default content.
      }
    }

    await writeGroupFile(db, groupId, DEFAULT_MAIN_GROUP_README_PATH, content);

    return true;
  } catch (error) {
    console.warn("Failed to ensure main workspace README:", error);

    return false;
  }
}
