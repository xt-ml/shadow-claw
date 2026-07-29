import { CONFIG_KEYS } from "../config/config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";

import type { SavedPageRef, ShadowClawDatabase } from "../db/types.js";

export function pageRefKey(groupId: string, path: string): string {
  return `${groupId}:${path}`;
}

export async function getSuppressedPages(
  db: ShadowClawDatabase,
): Promise<SavedPageRef[]> {
  const raw = await getConfig(db, CONFIG_KEYS.SUPPRESSED_PAGES_LIST);
  if (!raw || typeof raw !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as SavedPageRef[];
    }
  } catch {
    // Ignore invalid JSON
  }

  return [];
}

export async function isPageSuppressed(
  db: ShadowClawDatabase,
  groupId: string,
  path: string,
): Promise<boolean> {
  const list = await getSuppressedPages(db);
  const targetKey = pageRefKey(groupId, path);

  return list.some((ref) => pageRefKey(ref.groupId, ref.path) === targetKey);
}

export async function suppressPage(
  db: ShadowClawDatabase,
  groupId: string,
  path: string,
): Promise<void> {
  const list = await getSuppressedPages(db);
  const targetKey = pageRefKey(groupId, path);

  if (!list.some((ref) => pageRefKey(ref.groupId, ref.path) === targetKey)) {
    const updated = [...list, { groupId, path }];
    await setConfig(
      db,
      CONFIG_KEYS.SUPPRESSED_PAGES_LIST,
      JSON.stringify(updated),
    );
  }
}

export async function unsuppressPage(
  db: ShadowClawDatabase,
  groupId: string,
  path: string,
): Promise<void> {
  const list = await getSuppressedPages(db);
  const targetKey = pageRefKey(groupId, path);
  const filtered = list.filter(
    (ref) => pageRefKey(ref.groupId, ref.path) !== targetKey,
  );

  if (filtered.length !== list.length) {
    await setConfig(
      db,
      CONFIG_KEYS.SUPPRESSED_PAGES_LIST,
      JSON.stringify(filtered),
    );
  }
}
