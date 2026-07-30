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
import { deleteAllGroupFiles } from "./deleteAllGroupFiles.js";
import { deleteGroupDirectory } from "./deleteGroupDirectory.js";

import type { SavedPageRef, ShadowClawDatabase } from "../db/types.js";

export interface StaticPageSource {
  displayPath: string;
  content: string;
}

export interface StaticMainManifest {
  pages: StaticPageSource[];
  preRenderedStaticPages?: Record<string, any>;
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

async function processPurgeTokens(
  db: ShadowClawDatabase,
  node: Record<string, any>,
  currentPath: string[] = [],
) {
  for (const [key, value] of Object.entries(node)) {
    if (key === "purgePreRenderedStaticPages" && value === true) {
      if (currentPath.length > 0) {
        const groupId = currentPath[0];
        const dirPath = currentPath.slice(1).join("/");
        try {
          if (dirPath) {
            await deleteGroupDirectory(db, groupId, dirPath);
          } else {
            await deleteAllGroupFiles(db, groupId);
          }
        } catch (error) {
          console.warn(
            `Failed to purge pre-rendered static pages for ${groupId}/${dirPath}:`,
            error,
          );
        }
      }
    } else if (typeof value === "object" && value !== null) {
      await processPurgeTokens(db, value, [...currentPath, key]);
    }
  }
}

export async function seedStaticMainSite(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  existingPages: SavedPageRef[] = [],
): Promise<SavedPageRef[] & { didPurge?: boolean }> {
  await ensureMainGroupIndex(db, groupId);
  const manifest = await getStaticMainManifest();

  let didPurge = false;
  if (manifest.preRenderedStaticPages) {
    didPurge = true;
    await processPurgeTokens(db, manifest.preRenderedStaticPages);
  }

  for (const page of manifest.pages) {
    if (page.content?.includes('slug: "shadow-claw--purge-pages"')) {
      if (!didPurge) {
        didPurge = true;
        await deleteAllGroupFiles(db, groupId);
      }
      break;
    }
  }

  const isMemorySuppressed =
    groupId === DEFAULT_GROUP_ID
      ? await isMainGroupMemorySuppressed(db)
      : false;

  const resultPages: SavedPageRef[] & { didPurge?: boolean } = didPurge
    ? []
    : [...existingPages];

  for (const page of manifest.pages) {
    if (page.content?.includes('slug: "shadow-claw--purge-pages"')) {
      continue;
    }

    const isMemoryPath = /^memory\.(md|markdown)$/iu.test(page.displayPath);
    if (isMemoryPath) {
      if (isMemorySuppressed) {
        continue;
      }

      const customContent =
        page.content !== DEFAULT_MAIN_GROUP_MEMORY_CONTENT
          ? page.content
          : undefined;
      const ensured =
        customContent === undefined
          ? await ensureMainGroupMemory(db, groupId)
          : await ensureMainGroupMemory(db, groupId, customContent);
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

  Object.defineProperty(resultPages, "didPurge", {
    value: didPurge,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return resultPages;
}
