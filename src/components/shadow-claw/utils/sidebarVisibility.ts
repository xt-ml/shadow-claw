import { CONFIG_KEYS } from "../../../config/config.js";
import { getConfig } from "../../../db/getConfig.js";
import { parseConfigBoolean } from "./parseConfigBoolean.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

/**
 * Sidebar nav item keys and their corresponding CONFIG_KEYS.
 */
const SIDEBAR_VISIBILITY_MAP = {
  pages: CONFIG_KEYS.SIDEBAR_PAGES_HIDDEN,
  chat: CONFIG_KEYS.SIDEBAR_CHAT_HIDDEN,
  tasks: CONFIG_KEYS.SIDEBAR_TASKS_HIDDEN,
  files: CONFIG_KEYS.SIDEBAR_FILES_HIDDEN,
} as const;

export type SidebarNavPage = keyof typeof SIDEBAR_VISIBILITY_MAP;

/**
 * Apply the hidden attribute on a single sidebar nav item.
 */
export function applySidebarNavVisibility(
  shadow: ShadowRoot | null,
  page: SidebarNavPage,
  hidden: boolean,
) {
  if (!shadow) {
    return;
  }

  const navItem = shadow.querySelector(
    `.nav-item[data-page="${page}"]`,
  ) as HTMLElement | null;

  if (!navItem) {
    return;
  }

  navItem.hidden = hidden;
  navItem.setAttribute("aria-hidden", String(hidden));
}

/**
 * Get the property name on ShadowClaw for a nav item's hidden state.
 */
function getHiddenProp(
  page: SidebarNavPage,
): keyof Pick<
  ShadowClaw,
  | "pagesSidebarHidden"
  | "chatSidebarHidden"
  | "tasksSidebarHidden"
  | "filesSidebarHidden"
> {
  switch (page) {
    case "pages":
      return "pagesSidebarHidden";
    case "chat":
      return "chatSidebarHidden";
    case "tasks":
      return "tasksSidebarHidden";
    case "files":
      return "filesSidebarHidden";
  }
}

/**
 * Load all sidebar visibility preferences from config and apply them.
 * This generalizes `loadPagesSidebarVisibilityPreference` to cover all
 * four nav items.
 */
export async function loadAllSidebarVisibilityPreferences(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  _oStore: OrchestratorStore | undefined,
  db: ShadowClawDatabase,
): Promise<void> {
  for (const [page, configKey] of Object.entries(SIDEBAR_VISIBILITY_MAP)) {
    const navPage = page as SidebarNavPage;
    let hidden = false;

    if (db) {
      try {
        const raw = await getConfig(db, configKey);
        hidden = parseConfigBoolean(raw);
      } catch {
        hidden = false;
      }
    }

    const prop = getHiddenProp(navPage);
    shadowClaw[prop] = hidden;
    applySidebarNavVisibility(shadow, navPage, hidden);
  }
}

/**
 * Compute the best default sidebar page when the current page is hidden.
 * Respects all four hidden flags. Falls back to "pages" as absolute last resort.
 */
export function getDefaultVisibleSidebarPage(
  shadowClaw: ShadowClaw,
): "pages" | "chat" | "tasks" | "files" {
  const candidates: Array<"pages" | "chat" | "tasks" | "files"> = [
    "pages",
    "chat",
    "tasks",
    "files",
  ];
  const hidden: Record<string, boolean> = {
    pages: shadowClaw.pagesSidebarHidden,
    chat: shadowClaw.chatSidebarHidden,
    tasks: shadowClaw.tasksSidebarHidden,
    files: shadowClaw.filesSidebarHidden,
  };

  for (const page of candidates) {
    if (!hidden[page]) {
      return page;
    }
  }

  // Absolute fallback — never hide everything
  return "pages";
}
