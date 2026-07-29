/// <reference lib="dom" />
import { DEFAULT_GROUP_ID } from "../config/config.js";
import { DEFAULT_MAIN_GROUP_MEMORY_CONTENT } from "./defaultMemoryContent.mjs";
import {
  ensureMainGroupMemory,
  isMainGroupMemorySuppressed,
} from "./ensureMainGroupMemory.js";
import { groupFileExists } from "./groupFileExists.js";
import { writeGroupFile } from "./writeGroupFile.js";

import { isPageSuppressed, pageRefKey } from "./suppressedPages.js";

import { ensureMainGroupIndex } from "./ensureMainGroupIndex.js";

import type { SavedPageRef, ShadowClawDatabase } from "../db/types.js";

export interface StaticPageSource {
  displayPath: string;
  content: string;
}

export interface StaticMainManifest {
  pages: StaticPageSource[];
}

export const STATIC_MAIN_MANIFEST_PATH = "static-main-manifest.json";

export function resolveStaticMainManifestUrl(): string {
  const fallback = `/${STATIC_MAIN_MANIFEST_PATH}`;

  if (typeof document === "undefined" || !document.baseURI) {
    return fallback;
  }

  try {
    return new URL(STATIC_MAIN_MANIFEST_PATH, document.baseURI).toString();
  } catch {
    return fallback;
  }
}

export async function getStaticMainManifest(): Promise<StaticMainManifest> {
  if (typeof document !== "undefined") {
    const scriptEl = document.getElementById("shadow-claw-static-manifest");
    if (scriptEl && scriptEl.textContent) {
      try {
        const parsed = JSON.parse(scriptEl.textContent);
        if (parsed && Array.isArray(parsed.pages)) {
          return parsed as StaticMainManifest;
        }
      } catch (err) {
        console.warn("Failed to parse embedded static main manifest:", err);
      }
    }
  }

  if (typeof fetch === "function") {
    try {
      const url = resolveStaticMainManifestUrl();
      const res = await fetch(url);
      if (res.ok) {
        const parsed = await res.json();
        if (parsed && Array.isArray(parsed.pages)) {
          return parsed as StaticMainManifest;
        }
      }
    } catch {
      // Fetch failed or unavailable
    }
  }

  return {
    pages: [
      {
        displayPath: "MEMORY.md",
        content: DEFAULT_MAIN_GROUP_MEMORY_CONTENT,
      },
    ],
  };
}

export async function seedStaticMainSite(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  existingPages: SavedPageRef[] = [],
): Promise<SavedPageRef[]> {
  await ensureMainGroupIndex(db, groupId);
  const manifest = await getStaticMainManifest();
  const isMemorySuppressed =
    groupId === DEFAULT_GROUP_ID
      ? await isMainGroupMemorySuppressed(db)
      : false;

  const resultPages: SavedPageRef[] = [...existingPages];

  for (const page of manifest.pages) {
    const isMemoryPath = /^memory\.(md|markdown)$/iu.test(page.displayPath);
    if (isMemoryPath) {
      if (isMemorySuppressed) {
        continue;
      }

      const ensured = await ensureMainGroupMemory(db, groupId);
      if (ensured) {
        const refKey = pageRefKey(groupId, page.displayPath);
        if (
          !resultPages.some(
            (ref) => pageRefKey(ref.groupId, ref.path) === refKey,
          )
        ) {
          resultPages.push({ groupId, path: page.displayPath });
        }
      }
      continue;
    }

    if (await isPageSuppressed(db, groupId, page.displayPath)) {
      continue;
    }

    try {
      const exists = await groupFileExists(db, groupId, page.displayPath);
      if (!exists) {
        await writeGroupFile(db, groupId, page.displayPath, page.content);
      }

      const refKey = pageRefKey(groupId, page.displayPath);
      if (
        !resultPages.some((ref) => pageRefKey(ref.groupId, ref.path) === refKey)
      ) {
        resultPages.push({ groupId, path: page.displayPath });
      }
    } catch (error) {
      console.warn(
        `Failed to seed static page file ${page.displayPath}:`,
        error,
      );
    }
  }

  return resultPages;
}
