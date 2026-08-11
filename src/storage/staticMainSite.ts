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
  /** One-shot purge guard. Runtime stores this in localStorage after purging;
   *  subsequent boots skip the purge until the value changes. */
  purgeId?: string;
}

/** localStorage key that records the last completed purge run. */
export const PURGE_STORAGE_KEY = "sc:purge-id";

export const STATIC_MAIN_MANIFEST_PATH = "static-main-manifest.json";
export const STATIC_MAIN_DIR = "static-main";

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

export function resolveStaticMainFileUrl(displayPath: string): string {
  const cleanPath = displayPath.replace(/^\/+/, "");
  const relativePath = `${STATIC_MAIN_DIR}/${cleanPath}`;
  const fallback = `/${relativePath}`;

  if (typeof document === "undefined" || !document.baseURI) {
    return fallback;
  }

  try {
    return new URL(relativePath, document.baseURI).toString();
  } catch {
    return fallback;
  }
}

export async function fetchStaticMainManifest(): Promise<StaticMainManifest | null> {
  if (typeof fetch !== "function") {
    return null;
  }

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

  return null;
}

export async function fetchStaticMainFile(
  displayPath: string,
): Promise<string | null> {
  if (typeof fetch !== "function") {
    return null;
  }

  try {
    const url = resolveStaticMainFileUrl(displayPath);
    const res = await fetch(url);
    if (res.ok) {
      return await res.text();
    }
  } catch {
    // Fetch failed or unavailable
  }

  return null;
}

export async function getStaticMainManifest(
  options: { preferEmbedded?: boolean; fetchFallback?: boolean } = {},
): Promise<StaticMainManifest> {
  if (options.preferEmbedded !== false && typeof document !== "undefined") {
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

  if (options.fetchFallback !== false) {
    const fetched = await fetchStaticMainManifest();
    if (fetched) {
      return fetched;
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

export async function getStaticPageContent(
  displayPath: string,
): Promise<string | null> {
  if (typeof document !== "undefined") {
    const scriptEl = document.getElementById("shadow-claw-static-manifest");
    if (scriptEl && scriptEl.textContent) {
      try {
        const parsed = JSON.parse(scriptEl.textContent);
        if (parsed && Array.isArray(parsed.pages)) {
          const found = parsed.pages.find(
            (p: StaticPageSource) => p.displayPath === displayPath,
          );
          if (found && typeof found.content === "string") {
            return found.content;
          }
        }
      } catch {}
    }
  }

  const fileContent = await fetchStaticMainFile(displayPath);
  if (typeof fileContent === "string") {
    return fileContent;
  }

  const manifest = await fetchStaticMainManifest();
  if (manifest && Array.isArray(manifest.pages)) {
    const found = manifest.pages.find((p) => p.displayPath === displayPath);
    if (found && typeof found.content === "string") {
      return found.content;
    }
  }

  return null;
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

/** Returns true when a purge should be skipped because it already ran for
 *  this `purgeId` on this client. Updates localStorage when a purge is
 *  allowed so future boots are skipped. */
function checkAndMarkPurge(purgeId: string | undefined): boolean {
  if (!purgeId) {
    // No purgeId in manifest → always-purge (legacy behaviour).
    return false;
  }
  try {
    const lastPurgeId = localStorage.getItem(PURGE_STORAGE_KEY);
    if (lastPurgeId === purgeId) {
      // Already purged for this deployment — skip.
      return true;
    }
    // Record this purge run so next boot skips it.
    localStorage.setItem(PURGE_STORAGE_KEY, purgeId);
  } catch {
    // localStorage may be unavailable (e.g. private-browsing restrictions).
    // Fall through and allow the purge so we're never stuck.
  }
  return false;
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
    if (!checkAndMarkPurge(manifest.purgeId)) {
      didPurge = true;
      await processPurgeTokens(db, manifest.preRenderedStaticPages);
    }
  }

  for (const page of manifest.pages) {
    if (page.content?.includes('slug: "shadow-claw--purge-pages"')) {
      if (!didPurge && !checkAndMarkPurge(manifest.purgeId)) {
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

  const manifestKeys = new Set(
    manifest.pages.map((p) => pageRefKey(groupId, p.displayPath)),
  );

  const resultPages: SavedPageRef[] & { didPurge?: boolean } = didPurge
    ? existingPages.filter(
        (ref) =>
          ref.groupId !== groupId ||
          manifestKeys.has(pageRefKey(ref.groupId, ref.path)),
      )
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
