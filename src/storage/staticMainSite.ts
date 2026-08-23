import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../config/config.js";
import { DEFAULT_MAIN_GROUP_INDEX_CONTENT } from "./defaultIndexContent.mjs";
import { DEFAULT_MAIN_GROUP_MEMORY_CONTENT } from "./defaultMemoryContent.mjs";

import { applyBasePath } from "../core/app-routes.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";

import { deleteAllGroupFiles } from "./deleteAllGroupFiles.js";
import { deleteGroupDirectory } from "./deleteGroupDirectory.js";
import { ensureMainGroupIndex } from "./ensureMainGroupIndex.js";

import {
  ensureMainGroupMemory,
  isMainGroupMemorySuppressed,
} from "./ensureMainGroupMemory.js";

import { groupFileExists } from "./groupFileExists.js";
import { isPageSuppressed, pageRefKey } from "./suppressedPages.js";
import { writeGroupFile } from "./writeGroupFile.js";

import type { SavedPageRef, ShadowClawDatabase } from "../db/types.js";

export interface StaticPageSource {
  displayPath: string;
  content: string;
}

export interface StaticSkillSource {
  displayPath: string;
  content: string;
}

export interface StaticMainManifest {
  pages: StaticPageSource[];
  skills?: StaticSkillSource[];
  preRenderedStaticPages?: Record<string, any>;
  /** One-shot purge guard. Runtime stores this in localStorage after purging;
   *  subsequent boots skip the purge until the value changes. */
  purgeId?: string;
}

/** localStorage key that records the last completed purge run. */
export const PURGE_STORAGE_KEY = "sc:purge-id";
export const PURGE_CONFIG_KEY = "static_main_site_purge_id";
const LEGACY_PURGE_ID = "__legacy_purge_pages__";

export const STATIC_MAIN_MANIFEST_PATH = "static-main-manifest.json";
export const STATIC_MAIN_DIR = "static-main";

export function staticMainSiteSeededKey(
  groupId: string = DEFAULT_GROUP_ID,
): string {
  return groupId === DEFAULT_GROUP_ID
    ? CONFIG_KEYS.STATIC_MAIN_SITE_SEEDED
    : `${CONFIG_KEYS.STATIC_MAIN_SITE_SEEDED}:${groupId}`;
}

export async function isStaticMainSiteSeeded(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
): Promise<boolean> {
  const key = staticMainSiteSeededKey(groupId);
  const raw = (await getConfig(db, key)) as unknown;

  return raw === true || raw === "true";
}

export async function setStaticMainSiteSeeded(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  seeded: boolean = true,
): Promise<void> {
  const key = staticMainSiteSeededKey(groupId);
  await setConfig(db, key, seeded);
}

export function resolveStaticMainManifestUrl(): string {
  const targetPath = applyBasePath(`/${STATIC_MAIN_MANIFEST_PATH}`);

  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      return new URL(targetPath, window.location.origin).toString();
    } catch {
      return targetPath;
    }
  }

  return targetPath;
}

export function resolveStaticMainFileUrl(displayPath: string): string {
  const cleanPath = displayPath.replace(/^\/+/, "");
  const targetPath = applyBasePath(`/${STATIC_MAIN_DIR}/${cleanPath}`);

  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      return new URL(targetPath, window.location.origin).toString();
    } catch {
      return targetPath;
    }
  }

  return targetPath;
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
  const parseEmbedded = (): StaticMainManifest | null => {
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

    return null;
  };
  if (options.preferEmbedded !== false) {
    const embedded = parseEmbedded();
    if (embedded) {
      return embedded;
    }
  }

  if (options.fetchFallback !== false) {
    const fetched = await fetchStaticMainManifest();
    if (fetched) {
      return fetched;
    }
  }

  if (options.preferEmbedded === false) {
    const embedded = parseEmbedded();
    if (embedded) {
      return embedded;
    }
  }

  return {
    pages: [
      {
        displayPath: "index.html",
        content: DEFAULT_MAIN_GROUP_INDEX_CONTENT,
      },
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

function getSiteConfigSortOrder(): "asc" | "desc" {
  if (typeof document !== "undefined") {
    try {
      const scriptEl = document.getElementById("shadow-claw-site-config");
      if (scriptEl?.textContent) {
        const config = JSON.parse(scriptEl.textContent);
        if (config?.pages?.sortOrder === "desc") {
          return "desc";
        }
        if (config?.pages?.sortOrder === "asc") {
          return "asc";
        }
      }
    } catch {}
  }
  return "desc";
}

export function sortSavedPageRefs(
  refs: SavedPageRef[],
  sortOrder?: "asc" | "desc",
): SavedPageRef[] {
  const order = sortOrder ?? getSiteConfigSortOrder();
  return [...refs].sort((left, right) => {
    const leftPath = left.path;
    const rightPath = right.path;

    const leftFileName = leftPath.split("/").pop() || "";
    const rightFileName = rightPath.split("/").pop() || "";

    const leftIsIndex = /^index\.(html?|xhtml)$/iu.test(leftFileName);
    const rightIsIndex = /^index\.(html?|xhtml)$/iu.test(rightFileName);

    if (leftIsIndex && !rightIsIndex) {
      return -1;
    }

    if (!leftIsIndex && rightIsIndex) {
      return 1;
    }

    const leftIsMemory = /^memory\.(md|markdown)$/iu.test(leftFileName);
    const rightIsMemory = /^memory\.(md|markdown)$/iu.test(rightFileName);

    if (leftIsMemory && !rightIsMemory) {
      return 1;
    }

    if (!leftIsMemory && rightIsMemory) {
      return -1;
    }

    if (order === "asc") {
      return leftPath.localeCompare(rightPath, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    // Sort right-to-left (Z-A) with natural numeric handling
    return rightPath.localeCompare(leftPath, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

/** Returns true when a purge should be skipped because it already ran for
 * this deployment on this client. */
async function checkAndMarkPurge(
  db: ShadowClawDatabase,
  purgeId: string | undefined,
): Promise<boolean> {
  const effectivePurgeId = purgeId ?? LEGACY_PURGE_ID;
  try {
    const lastPurgeId = localStorage.getItem(PURGE_STORAGE_KEY);
    if (lastPurgeId === effectivePurgeId) {
      return true;
    }
  } catch {
    // Continue with IndexedDB when localStorage is unavailable.
  }

  try {
    const lastPurgeId = await getConfig(db, PURGE_CONFIG_KEY);
    if (lastPurgeId === effectivePurgeId) {
      try {
        localStorage.setItem(PURGE_STORAGE_KEY, effectivePurgeId);
      } catch {
        // IndexedDB is the durable record when localStorage is unavailable.
      }
      return true;
    }

    await setConfig(db, PURGE_CONFIG_KEY, effectivePurgeId);
    try {
      localStorage.setItem(PURGE_STORAGE_KEY, effectivePurgeId);
    } catch {
      // IndexedDB is the durable record when localStorage is unavailable.
    }
  } catch {
    // Fall back to localStorage when IndexedDB is unavailable.
    try {
      localStorage.setItem(PURGE_STORAGE_KEY, effectivePurgeId);
    } catch {
      // If neither store is available, allow the purge to proceed.
    }
  }
  return false;
}

export async function seedStaticMainSite(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  existingPages: SavedPageRef[] = [],
  options: { preferEmbedded?: boolean; fetchFallback?: boolean } = {},
): Promise<SavedPageRef[] & { didPurge?: boolean }> {
  await ensureMainGroupIndex(db, groupId);
  // When seeding on initial boot, prefer the embedded manifest so first paint / hydration
  // does not block on a heavy network request. Full background seeding can run separately.
  const manifest = await getStaticMainManifest(options);

  let didPurge = false;
  if (manifest.preRenderedStaticPages) {
    if (!(await checkAndMarkPurge(db, manifest.purgeId))) {
      didPurge = true;
      await processPurgeTokens(db, manifest.preRenderedStaticPages);
    }
  }

  for (const page of manifest.pages) {
    if (page.content?.includes('slug: "shadow-claw--purge-pages"')) {
      if (!didPurge && !(await checkAndMarkPurge(db, manifest.purgeId))) {
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
        let contentToWrite = page.content;
        if (typeof contentToWrite !== "string") {
          contentToWrite = (await fetchStaticMainFile(page.displayPath)) ?? "";
        }
        await writeGroupFile(db, groupId, page.displayPath, contentToWrite);
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

  // Bundled skills belong to the main conversation only. Other groups can
  // provide their own skills under their isolated workspace.
  if (groupId === DEFAULT_GROUP_ID) {
    for (const skill of manifest.skills || []) {
      const skillPath = `skills/main/${skill.displayPath}`;
      try {
        if (!(await groupFileExists(db, groupId, skillPath))) {
          await writeGroupFile(db, groupId, skillPath, skill.content);
        }
      } catch (error) {
        console.warn(`Failed to seed skill file ${skillPath}:`, error);
      }
    }
  }

  const hasEmbeddedScript =
    typeof document !== "undefined" &&
    document.getElementById("shadow-claw-static-manifest") !== null;
  const isPartialEmbeddedSeed =
    options.preferEmbedded !== false && hasEmbeddedScript;

  if (!isPartialEmbeddedSeed) {
    await setStaticMainSiteSeeded(db, groupId, true);
  }

  Object.defineProperty(resultPages, "didPurge", {
    value: didPurge,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return sortSavedPageRefs(resultPages);
}
