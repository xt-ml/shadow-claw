import { ASSISTANT_NAME, CONFIG_KEYS } from "../../config/config.js";
import {
  getNamespacedItem,
  setNamespacedItem,
} from "../../utils/namespacedStorage.js";

import {
  createSettingsBackupBlob,
  parseSettingsBackupPayload,
  reapplyPlaintextPasswords,
  writeSettingsBackupToFileHandle,
} from "../../config/settings-backup.js";

import { setAssistantName } from "../../core/orchestrator/utils/operations/provider.js";
import { getDb } from "../../db/db.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { showError, showInfo, showSuccess } from "../../ui/toast.js";
import { formatDateForFilename } from "../../utils/utils.js";
import { isTruthyConfigValue } from "../../common/utils/config-value.mjs";

import type { ConfigEntryRecord } from "../../config/settings-backup.js";
import type { Orchestrator } from "../../core/orchestrator/orchestrator.js";
import type { ShadowClawDatabase } from "../../db/types.js";

import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

const settingsTabLoaders: Record<string, (() => Promise<unknown>)[]> = {
  ai: [() => import("../settings/shadow-claw-llm/shadow-claw-llm.js")],
  environment: [
    () =>
      import("../settings/shadow-claw-networking/shadow-claw-networking.js"),
    () => import("../settings/shadow-claw-webvm/shadow-claw-webvm.js"),
    () => import("../settings/shadow-claw-storage/shadow-claw-storage.js"),
  ],
  integrations: [
    () => import("../settings/shadow-claw-git/shadow-claw-git.js"),
    () => import("../settings/shadow-claw-accounts/shadow-claw-accounts.js"),
    () =>
      import("../settings/shadow-claw-mcp-remote/shadow-claw-mcp-remote.js"),
    () =>
      import("../settings/shadow-claw-integrations/shadow-claw-integrations.js"),
    () =>
      import("../settings/shadow-claw-task-server/shadow-claw-task-server.js"),
    () =>
      import("../settings/shadow-claw-notifications/shadow-claw-notifications.js"),
  ],
};

const loadedSettingsTabs = new Set<string>();

async function ensureSettingsTabLoaded(tabId: string): Promise<void> {
  if (loadedSettingsTabs.has(tabId)) {
    return;
  }
  const loaders = settingsTabLoaders[tabId];
  if (loaders) {
    loadedSettingsTabs.add(tabId);
    await Promise.all(loaders.map((loader) => loader()));
  }
}

import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawSettingsStyles from "./shadow-claw-settings.css" with { type: "css" };
import shadowClawSettingsTemplate from "./shadow-claw-settings.html" with { type: "html" };

declare const __PRERENDER_MAIN_MEMORY__: boolean | undefined;

const elementName = "shadow-claw-settings";

/**
 * Parent settings component that composes the dedicated sub-components:
 *
 *  - <shadow-claw-llm>    — Provider, model, API key, and runtime controls
 *  - <shadow-claw-networking> — CORS proxy toggle and proxy URL
 *  - <shadow-claw-webvm>  — VM boot mode, timeout, host, relay
 *  - <shadow-claw-git>    — PAT, author config
 *  - <shadow-claw-storage>— OPFS, persistent, directory
 *
 *  - Channels button                — navigates to the channels config page
 *  - Tools button                   — navigates to the tools config page
 *  - Deployed revision footer
 */
export class ShadowClawSettings extends ShadowClawElement {
  static styles = shadowClawSettingsStyles;
  static template = shadowClawSettingsTemplate;

  activeTab = "ai";
  db: ShadowClawDatabase | null = null;
  orchestrator: Orchestrator | null = null;
  pendingRestoreFile: File | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();
    this.orchestrator = orchestratorStore.orchestrator;

    await this.render();
  }

  activateTab(tabId: string | undefined) {
    if (!tabId || this.activeTab === tabId) {
      return;
    }

    this.activeTab = tabId;
    this.applyTabState();
  }

  applyTabState() {
    ensureSettingsTabLoaded(this.activeTab).catch(console.error);

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const tabButtons =
      root.querySelectorAll<HTMLButtonElement>("[data-tab-target]");
    tabButtons.forEach((tabButton) => {
      const isActive = tabButton.dataset.tabTarget === this.activeTab;
      tabButton.classList.toggle("active", isActive);
      tabButton.setAttribute("aria-selected", String(isActive));
      tabButton.tabIndex = isActive ? 0 : -1;
    });

    const tabPanels = root.querySelectorAll<HTMLElement>("[data-tab-panel]");
    tabPanels.forEach((tabPanel) => {
      const isActive = tabPanel.dataset.tabPanel === this.activeTab;
      tabPanel.hidden = !isActive;
    });
  }

  bindSettingsActions() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="backup-settings"]')
      ?.addEventListener("click", () => this.openBackupDialog());

    const restoreInput = root.querySelector(
      ".settings__restore-input",
    ) as HTMLInputElement | null;

    root
      .querySelector('[data-action="restore-settings"]')
      ?.addEventListener("click", () => {
        if (restoreInput instanceof HTMLInputElement) {
          restoreInput.value = "";
          restoreInput.click();
        }
      });

    restoreInput?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const file = target.files?.[0] || null;
      if (!file) {
        return;
      }

      this.pendingRestoreFile = file;
      this.openRestoreDialog(file.name);
    });

    root
      .querySelector('[data-action="clear-settings"]')
      ?.addEventListener("click", () => this.openClearDialog());

    root
      .querySelector('[data-action="cancel-backup-settings"]')
      ?.addEventListener("click", () =>
        this.closeDialog(".settings__backup-dialog"),
      );

    root
      .querySelector('[data-action="confirm-backup-settings"]')
      ?.addEventListener("click", () => {
        void this.confirmBackup();
      });

    root
      .querySelector('[data-action="cancel-restore-settings"]')
      ?.addEventListener("click", () => {
        this.pendingRestoreFile = null;
        this.closeDialog(".settings__restore-dialog");
      });

    root
      .querySelector('[data-action="confirm-restore-settings"]')
      ?.addEventListener("click", () => {
        void this.confirmRestore();
      });

    root
      .querySelector('[data-action="cancel-clear-settings"]')
      ?.addEventListener("click", () =>
        this.closeDialog(".settings__clear-dialog"),
      );

    root
      .querySelector('[data-action="confirm-clear-settings"]')
      ?.addEventListener("click", () => {
        void this.confirmClear();
      });

    root
      .querySelector('[data-action="save-assistant-name"]')
      ?.addEventListener("click", () => this.saveAssistantName());

    root
      .querySelector('[data-setting="activity-log-disk-logging-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onActivityLogDiskLoggingToggle(target.checked);
        }
      });

    root
      .querySelector('[data-setting="sidebar-hide-pages-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onSidebarHidePagesToggle(target.checked);
        }
      });

    root
      .querySelector('[data-setting="sidebar-hide-chat-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onSidebarHideChatToggle(target.checked);
        }
      });

    root
      .querySelector('[data-setting="sidebar-hide-tasks-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onSidebarHideTasksToggle(target.checked);
        }
      });

    root
      .querySelector('[data-setting="sidebar-hide-files-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onSidebarHideFilesToggle(target.checked);
        }
      });

    root
      .querySelector('[data-setting="chat-split-view-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onChatSplitViewToggle(target.checked);
        }
      });

    root
      .querySelector('[data-setting="pages-auto-refresh-input"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          const val = parseInt(target.value, 10);
          void this.onPagesAutoRefreshInputChange(isNaN(val) ? 0 : val);
        }
      });

    root
      .querySelector('[data-setting="override-prerender-skeleton-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onOverridePrerenderSkeletonToggle(target.checked);
        }
      });

    root
      .querySelector('[data-action="save-dom-allowed-iframe-hosts"]')
      ?.addEventListener("click", () => {
        void this.saveDomAllowedIframeHosts();
      });
  }

  closeDialog(selector: string) {
    this.getDialog(selector)?.close();
  }

  getDialog(selector: string): HTMLDialogElement | null {
    const root = this.shadowRoot;
    if (!root) {
      return null;
    }

    const dialog = root.querySelector(selector);
    if (!(dialog instanceof HTMLDialogElement)) {
      return null;
    }

    return dialog;
  }

  handleTabKeydown(event: KeyboardEvent, currentButton: HTMLButtonElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const tabButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>("[data-tab-target]"),
    );

    const currentIndex = tabButtons.indexOf(currentButton);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex = -1;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % tabButtons.length;

        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;

        break;
      case "Home":
        nextIndex = 0;

        break;
      case "End":
        nextIndex = tabButtons.length - 1;

        break;
      default:
        return;
    }

    event.preventDefault();
    const nextButton = tabButtons[nextIndex];
    nextButton.focus();
    this.activateTab(nextButton.dataset.tabTarget);
  }

  openBackupDialog() {
    const root = this.shadowRoot;
    const includePlaintextToggle = root?.querySelector(
      '[data-setting="include-plaintext-passwords"]',
    );

    if (includePlaintextToggle instanceof HTMLInputElement) {
      includePlaintextToggle.checked = false;
    }

    this.showDialog(".settings__backup-dialog");
  }

  openClearDialog() {
    this.showDialog(".settings__clear-dialog");
  }

  openRestoreDialog(fileName: string) {
    const root = this.shadowRoot;
    const info = root?.querySelector('[data-info="restore-filename"]');
    if (info instanceof HTMLElement) {
      info.textContent = `Selected file: ${fileName}`;
    }

    this.showDialog(".settings__restore-dialog");
  }

  showDialog(selector: string) {
    const dialog = this.getDialog(selector);
    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === "function") {
      dialog.showModal();

      return;
    }

    dialog.setAttribute("open", "");
  }

  async confirmBackup() {
    if (!this.db) {
      showError("Settings database is unavailable", 5000);

      return;
    }

    const root = this.shadowRoot;
    const includePlaintextToggle = root?.querySelector(
      '[data-setting="include-plaintext-passwords"]',
    );

    const includePlaintextPasswords =
      includePlaintextToggle instanceof HTMLInputElement
        ? includePlaintextToggle.checked
        : false;

    try {
      if (includePlaintextPasswords) {
        const fileHandle = await this.promptForPlaintextBackupHandle();
        if (!fileHandle) {
          return;
        }

        const entries = await this.getAllConfigEntries();

        await writeSettingsBackupToFileHandle(
          fileHandle,
          entries,
          includePlaintextPasswords,
        );

        this.closeDialog(".settings__backup-dialog");
        showSuccess("Settings backup saved", 3000);

        return;
      }

      const entries = await this.getAllConfigEntries();
      const blob = await createSettingsBackupBlob(
        entries,
        includePlaintextPasswords,
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `shadowclaw-settings-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.closeDialog(".settings__backup-dialog");
      showSuccess("Settings backup downloaded", 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to backup settings: ${message}`, 6000);
    }
  }

  async confirmClear() {
    if (!this.db) {
      showError("Settings database is unavailable", 5000);

      return;
    }

    try {
      await this.replaceConfigEntries([]);
      this.closeDialog(".settings__clear-dialog");
      showInfo("Settings cleared. Reloading app...", 3200);

      setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to clear settings: ${message}`, 6000);
    }
  }

  async confirmRestore() {
    if (!this.db) {
      showError("Settings database is unavailable", 5000);

      return;
    }

    const file = this.pendingRestoreFile;
    if (!file) {
      showError("No backup file selected", 4000);

      return;
    }

    try {
      const text = await file.text();
      const backup = parseSettingsBackupPayload(text);
      const mergedEntries = await reapplyPlaintextPasswords(
        backup.configEntries,
        backup.plaintextPasswords || [],
      );

      await this.replaceConfigEntries(mergedEntries);
      this.pendingRestoreFile = null;
      this.closeDialog(".settings__restore-dialog");

      showSuccess("Settings restored. Reloading app...", 3200);
      setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to restore settings: ${message}`, 6000);
    }
  }

  async getAllConfigEntries(): Promise<ConfigEntryRecord[]> {
    if (!this.db) {
      throw new Error("Database is unavailable");
    }

    return await new Promise((resolve, reject) => {
      try {
        const tx = this.db?.transaction("config", "readonly");
        if (!tx) {
          reject(new Error("Failed to open read transaction"));

          return;
        }

        const store = tx.objectStore("config");
        const request = store.getAll();

        request.onsuccess = () => {
          const rows = Array.isArray(request.result) ? request.result : [];
          resolve(
            rows
              .filter((row) => row && typeof row.key === "string")
              .map((row) => ({ key: row.key, value: row.value })),
          );
        };

        request.onerror = () => {
          reject(request.error || new Error("Failed to read settings config"));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async onActivityLogDiskLoggingToggle(enabled: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.ACTIVITY_LOG_DISK_LOGGING_ENABLED,
        enabled ? "true" : "false",
      );

      showSuccess(
        enabled
          ? "Activity log disk logging enabled"
          : "Activity log disk logging disabled",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(
        "Error saving activity log disk logging setting: " + errorMsg,
        6000,
      );
    }
  }

  async onChatSplitViewToggle(enabled: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.CHAT_SPLIT_VIEW_ENABLED,
        enabled ? "true" : "false",
      );

      this.dispatchEvent(
        new CustomEvent("chat-split-view-change", {
          detail: { enabled },
          bubbles: true,
          composed: true,
        }),
      );

      showSuccess(
        enabled
          ? "Horizontal Chat split view enabled"
          : "Horizontal Chat split view disabled",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Chat split view setting: " + errorMsg, 6000);
    }
  }

  async onOverridePrerenderSkeletonToggle(enabled: boolean) {
    try {
      setNamespacedItem(
        "shadow-claw-override-prerender-skeleton",
        enabled ? "true" : "false",
      );
    } catch (e) {
      console.warn("Unable to save setting to localStorage:", e);
    }

    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.OVERRIDE_PRERENDER_SKELETON,
        enabled ? "true" : "false",
      );

      showSuccess(
        enabled
          ? "Pre-rendered content override enabled"
          : "Pre-rendered content override disabled",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(
        "Error saving pre-rendered content override setting: " + errorMsg,
        6000,
      );
    }
  }

  async onPagesAutoRefreshInputChange(valSec: number) {
    if (!this.db) {
      return;
    }

    const sec = Math.max(0, Math.min(valSec, 86400));

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.PAGES_AUTO_REFRESH_INTERVAL,
        String(sec),
      );

      window.dispatchEvent(
        new CustomEvent("shadow-claw-pages-auto-refresh-change", {
          detail: { interval: sec },
        }),
      );

      showSuccess(
        sec > 0
          ? `Pages auto refresh set to ${sec}s`
          : "Pages auto refresh disabled",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Pages auto refresh interval: " + errorMsg, 6000);
    }
  }

  async onSidebarHideChatToggle(hidden: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.SIDEBAR_CHAT_HIDDEN,
        hidden ? "true" : "false",
      );

      this.dispatchEvent(
        new CustomEvent("sidebar-chat-visibility-change", {
          detail: { hidden },
          bubbles: true,
          composed: true,
        }),
      );

      showSuccess(
        hidden ? "Chat hidden in sidebar" : "Chat shown in sidebar",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving sidebar Chat visibility: " + errorMsg, 6000);
    }
  }

  async onSidebarHideFilesToggle(hidden: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.SIDEBAR_FILES_HIDDEN,
        hidden ? "true" : "false",
      );

      this.dispatchEvent(
        new CustomEvent("sidebar-files-visibility-change", {
          detail: { hidden },
          bubbles: true,
          composed: true,
        }),
      );

      showSuccess(
        hidden ? "Files hidden in sidebar" : "Files shown in sidebar",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving sidebar Files visibility: " + errorMsg, 6000);
    }
  }

  async onSidebarHidePagesToggle(hidden: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.SIDEBAR_PAGES_HIDDEN,
        hidden ? "true" : "false",
      );

      this.dispatchEvent(
        new CustomEvent("sidebar-pages-visibility-change", {
          detail: { hidden },
          bubbles: true,
          composed: true,
        }),
      );

      showSuccess(
        hidden ? "Pages hidden in sidebar" : "Pages shown in sidebar",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving sidebar Pages visibility: " + errorMsg, 6000);
    }
  }

  async onSidebarHideTasksToggle(hidden: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.SIDEBAR_TASKS_HIDDEN,
        hidden ? "true" : "false",
      );

      this.dispatchEvent(
        new CustomEvent("sidebar-tasks-visibility-change", {
          detail: { hidden },
          bubbles: true,
          composed: true,
        }),
      );

      showSuccess(
        hidden ? "Tasks hidden in sidebar" : "Tasks shown in sidebar",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving sidebar Tasks visibility: " + errorMsg, 6000);
    }
  }

  async populateAssistantSettings() {
    const root = this.shadowRoot;
    if (!root || !this.db) {
      return;
    }

    const nameInput = root.querySelector(
      '[data-setting="assistant-name-input"]',
    ) as HTMLInputElement | null;
    if (nameInput) {
      const { getConfig } = await import("../../db/getConfig.js");
      const storedAssistantName = await getConfig(
        this.db,
        CONFIG_KEYS.ASSISTANT_NAME,
      );
      const orchestratorName =
        this.orchestrator?.assistantName ||
        orchestratorStore.orchestrator?.assistantName;

      nameInput.value =
        (typeof storedAssistantName === "string" && storedAssistantName) ||
        orchestratorName ||
        ASSISTANT_NAME;
    }

    const { getConfig } = await import("../../db/getConfig.js");
    const rawActivityLogDiskLoggingEnabled = (await getConfig(
      this.db,
      CONFIG_KEYS.ACTIVITY_LOG_DISK_LOGGING_ENABLED,
    )) as unknown;
    const activityLogDiskLoggingEnabled =
      rawActivityLogDiskLoggingEnabled === true ||
      rawActivityLogDiskLoggingEnabled === "true" ||
      rawActivityLogDiskLoggingEnabled === 1 ||
      rawActivityLogDiskLoggingEnabled === "1";

    const activityLogToggle = root.querySelector(
      '[data-setting="activity-log-disk-logging-toggle"]',
    ) as HTMLInputElement | null;
    if (activityLogToggle) {
      activityLogToggle.checked = activityLogDiskLoggingEnabled;
    }

    const rawSidebarPagesHidden = (await getConfig(
      this.db,
      CONFIG_KEYS.SIDEBAR_PAGES_HIDDEN,
    )) as unknown;
    const sidebarPagesHidden =
      rawSidebarPagesHidden === true ||
      rawSidebarPagesHidden === "true" ||
      rawSidebarPagesHidden === 1 ||
      rawSidebarPagesHidden === "1";

    const sidebarHidePagesToggle = root.querySelector(
      '[data-setting="sidebar-hide-pages-toggle"]',
    ) as HTMLInputElement | null;
    if (sidebarHidePagesToggle) {
      sidebarHidePagesToggle.checked = sidebarPagesHidden;
    }

    const rawSidebarChatHidden = (await getConfig(
      this.db,
      CONFIG_KEYS.SIDEBAR_CHAT_HIDDEN,
    )) as unknown;
    const sidebarChatHidden =
      rawSidebarChatHidden === true ||
      rawSidebarChatHidden === "true" ||
      rawSidebarChatHidden === 1 ||
      rawSidebarChatHidden === "1";

    const sidebarHideChatToggle = root.querySelector(
      '[data-setting="sidebar-hide-chat-toggle"]',
    ) as HTMLInputElement | null;
    if (sidebarHideChatToggle) {
      sidebarHideChatToggle.checked = sidebarChatHidden;
    }

    const rawSidebarTasksHidden = (await getConfig(
      this.db,
      CONFIG_KEYS.SIDEBAR_TASKS_HIDDEN,
    )) as unknown;
    const sidebarTasksHidden =
      rawSidebarTasksHidden === true ||
      rawSidebarTasksHidden === "true" ||
      rawSidebarTasksHidden === 1 ||
      rawSidebarTasksHidden === "1";

    const sidebarHideTasksToggle = root.querySelector(
      '[data-setting="sidebar-hide-tasks-toggle"]',
    ) as HTMLInputElement | null;
    if (sidebarHideTasksToggle) {
      sidebarHideTasksToggle.checked = sidebarTasksHidden;
    }

    const rawSidebarFilesHidden = (await getConfig(
      this.db,
      CONFIG_KEYS.SIDEBAR_FILES_HIDDEN,
    )) as unknown;
    const sidebarFilesHidden =
      rawSidebarFilesHidden === true ||
      rawSidebarFilesHidden === "true" ||
      rawSidebarFilesHidden === 1 ||
      rawSidebarFilesHidden === "1";

    const sidebarHideFilesToggle = root.querySelector(
      '[data-setting="sidebar-hide-files-toggle"]',
    ) as HTMLInputElement | null;
    if (sidebarHideFilesToggle) {
      sidebarHideFilesToggle.checked = sidebarFilesHidden;
    }

    const rawChatSplitViewEnabled = (await getConfig(
      this.db,
      CONFIG_KEYS.CHAT_SPLIT_VIEW_ENABLED,
    )) as unknown;
    const chatSplitViewEnabled = isTruthyConfigValue(
      rawChatSplitViewEnabled,
      false,
    );

    const chatSplitViewToggle = root.querySelector(
      '[data-setting="chat-split-view-toggle"]',
    ) as HTMLInputElement | null;
    if (chatSplitViewToggle) {
      chatSplitViewToggle.checked = chatSplitViewEnabled;
    }

    const pagesAutoRefreshInput = root.querySelector(
      '[data-setting="pages-auto-refresh-input"]',
    ) as HTMLInputElement | null;
    if (pagesAutoRefreshInput) {
      const storedInterval = await getConfig(
        this.db,
        CONFIG_KEYS.PAGES_AUTO_REFRESH_INTERVAL,
      );
      if (
        typeof storedInterval === "string" ||
        typeof storedInterval === "number"
      ) {
        const parsed = parseInt(String(storedInterval), 10);
        pagesAutoRefreshInput.value =
          !isNaN(parsed) && parsed >= 0 ? String(parsed) : "0";
      } else {
        pagesAutoRefreshInput.value = "0";
      }
    }

    const rawOverridePrerenderSkeleton = (await getConfig(
      this.db,
      CONFIG_KEYS.OVERRIDE_PRERENDER_SKELETON,
    )) as unknown;
    let storedLocalStorage: string | null = null;
    try {
      storedLocalStorage = getNamespacedItem(
        "shadow-claw-override-prerender-skeleton",
      );
    } catch {
      // Ignore
    }

    // @ts-ignore
    const defaultOverride =
      typeof __PRERENDER_MAIN_MEMORY__ !== "undefined"
        ? __PRERENDER_MAIN_MEMORY__
        : true;

    let overridePrerenderSkeleton = defaultOverride;
    if (
      rawOverridePrerenderSkeleton !== null &&
      rawOverridePrerenderSkeleton !== undefined
    ) {
      overridePrerenderSkeleton = isTruthyConfigValue(
        rawOverridePrerenderSkeleton,
      );
    } else if (storedLocalStorage !== null) {
      overridePrerenderSkeleton = storedLocalStorage === "true";
    }

    if (overridePrerenderSkeleton) {
      try {
        setNamespacedItem("shadow-claw-override-prerender-skeleton", "true");
      } catch {
        // Ignore localStorage quota / access errors
      }
    }

    const overridePrerenderSkeletonToggle = root.querySelector(
      '[data-setting="override-prerender-skeleton-toggle"]',
    ) as HTMLInputElement | null;
    if (overridePrerenderSkeletonToggle) {
      overridePrerenderSkeletonToggle.checked = overridePrerenderSkeleton;
    }

    const domHostsTextarea = root.querySelector(
      '[data-setting="dom-allowed-iframe-hosts"]',
    ) as HTMLTextAreaElement | null;
    if (domHostsTextarea) {
      const storedDomHosts = await getConfig(
        this.db,
        CONFIG_KEYS.ALLOWED_IFRAME_HOST_PATTERNS,
      );

      if (
        typeof storedDomHosts === "string" &&
        storedDomHosts.trim().length > 0
      ) {
        domHostsTextarea.value = storedDomHosts;
        const { setAllowedIframeHostPatterns } =
          await import("../../security/iframe-sanitizer.js");
        setAllowedIframeHostPatterns(storedDomHosts);
      } else {
        const { DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS } =
          await import("../../security/iframe-sanitizer.js");
        domHostsTextarea.value =
          DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS.join("\n");
      }
    }

    const markdownFrontmatterPagesToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-pages-toggle"]',
    ) as HTMLInputElement | null;
    if (markdownFrontmatterPagesToggle) {
      markdownFrontmatterPagesToggle.checked = isTruthyConfigValue(
        await getConfig(this.db, CONFIG_KEYS.MARKDOWN_FRONTMATTER_PAGES),
        true,
      );
    }

    const markdownFrontmatterFileViewerToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-file-viewer-toggle"]',
    ) as HTMLInputElement | null;
    if (markdownFrontmatterFileViewerToggle) {
      markdownFrontmatterFileViewerToggle.checked = isTruthyConfigValue(
        await getConfig(this.db, CONFIG_KEYS.MARKDOWN_FRONTMATTER_FILE_VIEWER),
        true,
      );
    }

    const markdownFrontmatterChatToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-chat-toggle"]',
    ) as HTMLInputElement | null;
    if (markdownFrontmatterChatToggle) {
      markdownFrontmatterChatToggle.checked = isTruthyConfigValue(
        await getConfig(this.db, CONFIG_KEYS.MARKDOWN_FRONTMATTER_CHAT),
        true,
      );
    }

    const markdownFrontmatterTasksToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-tasks-toggle"]',
    ) as HTMLInputElement | null;
    if (markdownFrontmatterTasksToggle) {
      markdownFrontmatterTasksToggle.checked = isTruthyConfigValue(
        await getConfig(this.db, CONFIG_KEYS.MARKDOWN_FRONTMATTER_TASKS),
        true,
      );
    }
  }

  async promptForPlaintextBackupHandle(): Promise<FileSystemFileHandle | null> {
    const pickerMaybe = Reflect.get(globalThis, "showSaveFilePicker");
    const picker =
      typeof pickerMaybe === "function" ? pickerMaybe.bind(globalThis) : null;

    if (!picker) {
      throw new Error(
        "Plaintext settings backup requires the File System Access API.",
      );
    }

    try {
      return await picker({
        id: "shadowclaw-settings-backup",
        suggestedName: `shadowclaw-settings-backup-${formatDateForFilename()}.json`,
        types: [
          {
            description: "JSON Files",
            accept: {
              "application/json": [".json"],
            },
          },
        ],
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return null;
      }

      throw error;
    }
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const showChannelsConfigButton = root.querySelector(
      '[data-action="show-channels-config"]',
    );
    showChannelsConfigButton?.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { page: "channels" },
          bubbles: true,
          composed: true,
        }),
      );
    });

    const showToolsConfigButton = root.querySelector(
      '[data-action="show-tools-config"]',
    );
    showToolsConfigButton?.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("navigate", {
          detail: { page: "tools" },
          bubbles: true,
          composed: true,
        }),
      );
    });

    const tabButtons =
      root.querySelectorAll<HTMLButtonElement>("[data-tab-target]");
    tabButtons.forEach((tabButton) => {
      tabButton.addEventListener("click", () => {
        this.activateTab(tabButton.dataset.tabTarget);
      });

      tabButton.addEventListener("keydown", (event) => {
        this.handleTabKeydown(event, tabButton);
      });
    });
    this.applyTabState();

    this.bindSettingsActions();

    const revisionEl = root.querySelector('[data-info="deployed-revision"]');
    if (revisionEl) {
      const revision =
        document
          .querySelector('meta[name="revision"]')
          ?.getAttribute("content")
          ?.trim() || "";
      revisionEl.textContent = `Deployed revision: ${revision || "unknown"}`;
    }

    await this.populateAssistantSettings();
  }

  async replaceConfigEntries(entries: ConfigEntryRecord[]): Promise<void> {
    if (!this.db) {
      throw new Error("Database is unavailable");
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = this.db?.transaction("config", "readwrite");
        if (!tx) {
          reject(new Error("Failed to open write transaction"));

          return;
        }

        const store = tx.objectStore("config");
        store.clear();
        for (const entry of entries) {
          store.put({ key: entry.key, value: entry.value });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(tx.error || new Error("Failed to update config"));
        tx.onabort = () =>
          reject(tx.error || new Error("Config update aborted"));
      } catch (error) {
        reject(error);
      }
    });
  }

  async saveAssistantName() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const nameInput = root.querySelector(
      '[data-setting="assistant-name-input"]',
    ) as HTMLInputElement | null;
    if (!nameInput) {
      return;
    }

    const name = nameInput.value.trim();
    if (!name) {
      const { showWarning } = await import("../../ui/toast.js");
      showWarning("Please enter a name", 3000);

      return;
    }

    setNamespacedItem("assistantName", name);

    try {
      const orchestrator = this.orchestrator || orchestratorStore.orchestrator;
      if (orchestrator) {
        this.orchestrator = orchestrator;
        await setAssistantName(orchestrator, this.db, name);
      } else {
        const { setConfig } = await import("../../db/setConfig.js");
        await setConfig(this.db, CONFIG_KEYS.ASSISTANT_NAME, name);
      }
    } catch (e) {
      console.warn("Could not update orchestrator:", e);
    }

    showSuccess("Assistant name saved", 3000);
  }

  async saveDomAllowedIframeHosts() {
    const root = this.shadowRoot;
    if (!root || !this.db) {
      return;
    }

    const textarea = root.querySelector(
      '[data-setting="dom-allowed-iframe-hosts"]',
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }

    const rawText = textarea.value;
    const lines = rawText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const markdownFrontmatterPagesToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-pages-toggle"]',
    ) as HTMLInputElement | null;
    const markdownFrontmatterFileViewerToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-file-viewer-toggle"]',
    ) as HTMLInputElement | null;
    const markdownFrontmatterChatToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-chat-toggle"]',
    ) as HTMLInputElement | null;
    const markdownFrontmatterTasksToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-tasks-toggle"]',
    ) as HTMLInputElement | null;

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      const valueToSave = lines.join("\n");
      await setConfig(
        this.db,
        CONFIG_KEYS.ALLOWED_IFRAME_HOST_PATTERNS,
        valueToSave,
      );

      await setConfig(
        this.db,
        CONFIG_KEYS.MARKDOWN_FRONTMATTER_PAGES,
        String(markdownFrontmatterPagesToggle?.checked ?? true),
      );

      await setConfig(
        this.db,
        CONFIG_KEYS.MARKDOWN_FRONTMATTER_FILE_VIEWER,
        String(markdownFrontmatterFileViewerToggle?.checked ?? true),
      );

      await setConfig(
        this.db,
        CONFIG_KEYS.MARKDOWN_FRONTMATTER_CHAT,
        String(markdownFrontmatterChatToggle?.checked ?? true),
      );

      await setConfig(
        this.db,
        CONFIG_KEYS.MARKDOWN_FRONTMATTER_TASKS,
        String(markdownFrontmatterTasksToggle?.checked ?? true),
      );

      const { setAllowedIframeHostPatterns } =
        await import("../../security/iframe-sanitizer.js");
      setAllowedIframeHostPatterns(lines);

      showSuccess("DOM iframe embed settings saved", 2500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving DOM iframe embed settings: " + errorMsg, 6000);
    }
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawSettings);
}
