import { CONFIG_KEYS } from "../../../config/config.js";
import { effect } from "../../../core/effect.js";

import { getDb } from "../../../db/db.js";
import { getConfig } from "../../../db/get-config.js";

import { setSanitizedHtml } from "../../../security/trusted-types.js";
import { getStorageEstimate } from "../../../storage/get-storage-estimate.js";
import { isPersistent } from "../../../storage/is-persistent.js";
import { requestPersistentStorage } from "../../../storage/request-persistent-storage.js";
import { selectStorageDirectory } from "../../../storage/select-storage-directory.js";
import { resetStorageDirectory } from "../../../storage/storage.js";

import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess, showWarning } from "../../../ui/toast.js";
import { isTruthyConfigValue } from "../../../utils/parse-boolean-config.js";
import {
  clearBrowserModelCaches,
  exportBrowserModelsToSharedDir,
  getBrowserModelCacheStats,
  getSharedModelDirStatus,
  migrateBrowserModelCache,
  normalizeSharedModelMirrorUrl,
  resetSharedModelCacheConfigCache,
  resetSharedModelCacheDirectory,
  selectSharedModelCacheDirectory,
} from "../../../subsystems/providers/utils/shared-model-cache.js";

import type { ShadowClawDatabase } from "../../../db/types.js";

import ShadowClawElement, { defineElement } from "../../shadow-claw-element.js";
import shadowClawStorageStyles from "./shadow-claw-storage.css" with { type: "css" };
import shadowClawStorageTemplate from "./shadow-claw-storage.html" with { type: "html" };

const elementName = "shadow-claw-storage";

/**
 * Settings sub-component for Storage configuration:
 * usage display, persistent storage, directory selection.
 */
export class ShadowClawStorage extends ShadowClawElement {
  static styles = shadowClawStorageStyles;
  static template = shadowClawStorageTemplate;

  public db: ShadowClawDatabase | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();

    this.bindEventListeners();
    this.setupEffects();

    await this.updateStorageInfo();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  /**
   * Bind all event listeners.
   */
  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="request-persistent"]')
      ?.addEventListener("click", () => this.handleRequestPersistent());

    root
      .querySelector('[data-action="change-storage-dir"]')
      ?.addEventListener("click", () => this.handleChangeStorageDir());

    root
      .querySelector('[data-action="reset-storage-dir"]')
      ?.addEventListener("click", () => this.handleResetStorageDir());

    root
      .querySelector('[data-action="reset-site-config"]')
      ?.addEventListener("click", () => this.handleResetSiteConfig());

    root
      .querySelector('[data-action="grant-storage-permission"]')
      ?.addEventListener("click", () => {
        if (this.db) {
          orchestratorStore.grantStorageAccess(this.db);
        }
      });

    root
      .querySelector('[data-setting="files-upload-append-ulid-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onUploadAppendUlidToggle(target.checked);
        }
      });

    root
      .querySelector('[data-setting="shared-model-cache-origin-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onSharedModelCacheOriginToggle(target.checked);
        }
      });

    root
      .querySelector('[data-action="select-shared-model-dir"]')
      ?.addEventListener("click", () => {
        void this.handleSelectSharedModelDir();
      });

    root
      .querySelector('[data-action="sync-shared-model-dir"]')
      ?.addEventListener("click", () => {
        void this.handleSyncSharedModelDir();
      });

    root
      .querySelector('[data-action="clear-shared-model-dir"]')
      ?.addEventListener("click", () => {
        void this.handleClearSharedModelDir();
      });

    root
      .querySelector('[data-setting="shared-model-cache-mirror-toggle"]')
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target) {
          void this.onSharedModelCacheMirrorToggle(target.checked);
        }
      });

    root
      .querySelector('[data-action="save-shared-model-cache-url"]')
      ?.addEventListener("click", () => {
        void this.handleSaveSharedModelCacheUrl();
      });

    root
      .querySelector('[data-action="clear-browser-model-cache"]')
      ?.addEventListener("click", () => {
        void this.handleClearBrowserModelCache();
      });
  }

  /**
   * Format bytes to human readable string.
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) {
      return "0 B";
    }

    const k = 1024;
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + units[i];
  }

  /**
   * Setup reactive effects for storage status from orchestratorStore.
   */
  setupEffects() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    this.addCleanup(
      effect(() => {
        const status = orchestratorStore.storageStatus;
        if (!status) {
          return;
        }

        const typeEl = root.querySelector('[data-info="storage-type"]');
        const statusBadge = root.querySelector(
          '[data-info="storage-status-badge"]',
        ) as HTMLElement | null;
        const grantBtn = root.querySelector(
          '[data-action="grant-storage-permission"]',
        ) as HTMLElement | null;

        if (typeEl) {
          typeEl.textContent =
            status.type === "local"
              ? "Local Directory"
              : "Browser Internal (OPFS)";
        }

        if (statusBadge) {
          statusBadge.style.display =
            status.type === "local" ? "inline-block" : "none";
          if (status.type === "local") {
            statusBadge.textContent =
              status.permission === "granted"
                ? "CONNECTED"
                : "NEEDS PERMISSION";
            statusBadge.style.backgroundColor =
              status.permission === "granted"
                ? "var(--shadow-claw-success-color)"
                : "var(--shadow-claw-error-color)";
            statusBadge.style.color = "white";
          }
        }

        if (grantBtn) {
          grantBtn.style.display =
            status.type === "local" && status.permission !== "granted"
              ? "inline-block"
              : "none";
        }
      }),
    );
  }

  /**
   * Handle changing storage directory.
   */
  async handleChangeStorageDir() {
    if (!this.db) {
      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Change Storage Location",
      message:
        "Switching storage location will point ShadowClaw to a local folder on disk.",
      details: [
        "Existing files in browser storage (OPFS) will NOT be copied or moved.",
        "Your current files remain safe in browser storage and can be accessed again by clicking 'Reset to Default'.",
        "To keep existing files in the new location, consider downloading a ZIP backup first.",
      ],
      confirmLabel: "Choose Folder",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    try {
      const success = await selectStorageDirectory(this.db);
      if (success) {
        showSuccess(
          "Storage location changed. Existing OPFS files were not moved.",
          4500,
        );

        await this.updateStorageInfo();
        await orchestratorStore.loadFiles(this.db);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to change storage location: ${errorMsg}`, 6000);
    }
  }

  /**
   * Handle persistent storage request.
   */
  async handleRequestPersistent() {
    if (!this.db) {
      return;
    }

    try {
      const granted = await requestPersistentStorage();
      if (granted) {
        showSuccess("Persistent storage granted", 3500);
      } else {
        showWarning(
          "Persistent storage was not granted. Browsers may deny this based on site usage.",
          5500,
        );
      }

      await this.updateStorageInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Storage request failed: ${errorMsg}`, 6000);
    }
  }

  async handleResetSiteConfig() {
    if (!this.db) {
      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Reset Site Config",
      message:
        "Allow embedded site-config.json defaults to apply again after the next reload?",
      confirmLabel: "Reset",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    try {
      await orchestratorStore.resetSiteConfigSeed(this.db);
      showSuccess(
        "Site config reset. Reload to apply its defaults again.",
        5000,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to reset site config: ${errorMsg}`, 6000);
    }
  }

  /**
   * Handle resetting storage directory.
   */
  async handleResetStorageDir() {
    if (!this.db) {
      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Reset Storage Location",
      message: "Revert storage to browser-internal (OPFS)?",
      confirmLabel: "Revert",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    try {
      await resetStorageDirectory(this.db);

      showSuccess("Reverted to browser-internal storage", 3500);

      await this.updateStorageInfo();
      await orchestratorStore.loadFiles(this.db);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to reset storage location: ${errorMsg}`, 6000);
    }
  }

  /**
   * Handle toggling unique ID prefix for uploaded files.
   */
  async onUploadAppendUlidToggle(enabled: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../../db/set-config.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.FILES_UPLOAD_APPEND_ULID,
        enabled ? "true" : "false",
      );

      showSuccess(
        enabled
          ? "Unique ID prefix on file upload enabled"
          : "Unique ID prefix on file upload disabled",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(
        "Error saving unique ID file upload setting: " + errorMsg,
        6000,
      );
    }
  }

  async requestConfirmation(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    details?: string[];
  }): Promise<boolean> {
    const appShell = document.querySelector("shadow-claw") as any;
    if (appShell && typeof appShell.requestDialog === "function") {
      return await appShell.requestDialog({ mode: "confirm", ...options });
    }

    showWarning(options.message, 4500);

    return false;
  }

  /**
   * Update storage information in UI.
   */
  async updateStorageInfo() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    try {
      const estimate = await getStorageEstimate();
      const usageStr = this.formatBytes(estimate.usage);
      const quotaStr = this.formatBytes(estimate.quota);
      const percent =
        estimate.quota > 0 ? (estimate.usage / estimate.quota) * 100 : 0;

      const usageEl = root.querySelector('[data-info="storage-usage"]');
      const quotaEl = root.querySelector('[data-info="storage-quota"]');
      const progressEl = root.querySelector(
        '[data-info="storage-progress"]',
      ) as HTMLElement | null;

      const typeEl = root.querySelector('[data-info="storage-type"]');
      const persistentBadge = root.querySelector(
        '[data-info="storage-persistent-badge"]',
      ) as HTMLElement | null;

      if (usageEl) {
        usageEl.textContent = `${usageStr} used`;
      }

      if (quotaEl) {
        quotaEl.textContent = `of ${quotaStr}`;
      }

      if (progressEl) {
        progressEl.style.width = `${percent}%`;
      }

      // Check storage type
      const handle = await getConfig(this.db, CONFIG_KEYS.STORAGE_HANDLE);
      if (typeEl) {
        typeEl.textContent = handle
          ? "Local Directory"
          : "Browser Internal (OPFS)";
      }

      // Check persistence
      const persistent = await isPersistent();
      if (persistentBadge) {
        persistentBadge.style.display = persistent ? "inline-block" : "none";
      }

      // Update help text
      const helpGeneralEl = root.querySelector(
        '[data-info="storage-help-general"]',
      );

      const helpLocalEl = root.querySelector(
        '[data-info="storage-help-local"]',
      );

      if (helpGeneralEl) {
        setSanitizedHtml(
          helpGeneralEl,
          handle
            ? `Persistent storage protects your <b>chat history, tasks, and settings</b> in the browser database.
            Without it, the browser might clear this data if your disk is almost full.`
            : `Persistent storage protects your <b>files, chat history, and settings</b> in the browser.
            Without it, the browser might clear your data if your disk is almost full.`,
        );
      }

      if (helpLocalEl) {
        setSanitizedHtml(
          helpLocalEl,
          handle
            ? `ShadowClaw is currently <b>connected to a local folder</b>. Your files are safe on your disk,
            but browser persistence is still recommended for your chat history.`
            : `You can use a local folder on your computer for storage. This makes files directly accessible
            on your disk and independent of browser storage limits.`,
        );
      }

      // Disable persistent button if already persistent
      const requestPersistentBtn = root.querySelector(
        '[data-action="request-persistent"]',
      ) as HTMLButtonElement | null;
      if (requestPersistentBtn) {
        requestPersistentBtn.disabled = persistent;
      }

      // Sync upload append ULID toggle
      const uploadAppendUlidVal = await getConfig(
        this.db,
        CONFIG_KEYS.FILES_UPLOAD_APPEND_ULID,
      );
      const uploadAppendUlidToggle = root.querySelector(
        '[data-setting="files-upload-append-ulid-toggle"]',
      ) as HTMLInputElement | null;
      if (uploadAppendUlidToggle) {
        uploadAppendUlidToggle.checked = isTruthyConfigValue(
          uploadAppendUlidVal,
          false,
        );
      }

      const [modelScopeVal, mirrorEnabledVal, mirrorUrlVal] = await Promise.all(
        [
          getConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_SCOPE),
          getConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_MIRROR_ENABLED),
          getConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_URL),
        ],
      );

      const resolvedScope =
        modelScopeVal === "deployment" ? "deployment" : "origin";

      const originToggle = root.querySelector(
        '[data-setting="shared-model-cache-origin-toggle"]',
      ) as HTMLInputElement | null;
      if (originToggle) {
        originToggle.checked = resolvedScope === "origin";
      }

      const mirrorToggle = root.querySelector(
        '[data-setting="shared-model-cache-mirror-toggle"]',
      ) as HTMLInputElement | null;
      if (mirrorToggle) {
        mirrorToggle.checked = isTruthyConfigValue(mirrorEnabledVal, false);
      }

      const mirrorUrlInput = root.querySelector(
        '[data-setting="shared-model-cache-url"]',
      ) as HTMLInputElement | null;
      if (mirrorUrlInput) {
        mirrorUrlInput.value =
          typeof mirrorUrlVal === "string" ? mirrorUrlVal : "";
      }

      const dirStatus = await getSharedModelDirStatus(this.db);
      const dirStatusEl = root.querySelector(
        '[data-info="shared-model-dir-status"]',
      );
      const syncDirBtn = root.querySelector(
        '[data-action="sync-shared-model-dir"]',
      );
      const clearDirBtn = root.querySelector(
        '[data-action="clear-shared-model-dir"]',
      );
      if (dirStatusEl) {
        if (!dirStatus.connected) {
          dirStatusEl.textContent = "Not connected";
        } else if (dirStatus.permission === "granted") {
          dirStatusEl.textContent = `Connected${dirStatus.name ? `: ${dirStatus.name}` : ""}`;
        } else {
          dirStatusEl.textContent = `Reconnect required (${dirStatus.name || "folder"})`;
        }
      }
      syncDirBtn?.classList.toggle("hidden", !dirStatus.connected);
      clearDirBtn?.classList.toggle("hidden", !dirStatus.connected);

      const cacheStats = await getBrowserModelCacheStats(resolvedScope);
      const cacheStatsEl = root.querySelector(
        '[data-info="browser-model-cache-stats"]',
      );
      if (cacheStatsEl) {
        cacheStatsEl.textContent = `${this.formatBytes(cacheStats.totalBytes)} cached (${cacheStats.entryCount} ${cacheStats.entryCount === 1 ? "entry" : "entries"})`;
      }
    } catch (err) {
      console.warn("Failed to update storage info:", err);
    }
  }

  async onSharedModelCacheOriginToggle(shareOrigin: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const fromScope = shareOrigin ? "deployment" : "origin";
      const toScope = shareOrigin ? "origin" : "deployment";
      const migration = await migrateBrowserModelCache(fromScope, toScope, {
        deleteSource: shareOrigin,
      });

      const { setConfig } = await import("../../../db/set-config.js");
      await setConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_SCOPE, toScope);
      resetSharedModelCacheConfigCache();

      const migratedSuffix =
        migration.migratedEntries > 0
          ? ` (migrated ${migration.migratedEntries} cached entries)`
          : "";
      showSuccess(
        (shareOrigin
          ? "Browser model cache shared across apps on this domain"
          : "Browser model cache isolated per site deployment") +
          migratedSuffix,
        2500,
      );
      await this.updateStorageInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Error saving model cache scope: ${errorMsg}`, 6000);
    }
  }

  async onSharedModelCacheMirrorToggle(enabled: boolean) {
    if (!this.db) {
      return;
    }

    try {
      const { setConfig } = await import("../../../db/set-config.js");
      await setConfig(
        this.db,
        CONFIG_KEYS.SHARED_MODEL_CACHE_MIRROR_ENABLED,
        enabled ? "true" : "false",
      );
      resetSharedModelCacheConfigCache();
      showSuccess(
        enabled
          ? "Shared Model Cache Mirror enabled"
          : "Shared Model Cache Mirror disabled",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Error saving mirror toggle: ${errorMsg}`, 6000);
    }
  }

  async handleSaveSharedModelCacheUrl() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    const input = root?.querySelector(
      '[data-setting="shared-model-cache-url"]',
    ) as HTMLInputElement | null;
    const raw = input?.value?.trim() || "";

    if (raw && !normalizeSharedModelMirrorUrl(raw)) {
      input?.setAttribute("aria-invalid", "true");
      showError("Mirror URL must use http:// or https://", 5000);
      return;
    }

    input?.removeAttribute("aria-invalid");
    const normalized = raw ? normalizeSharedModelMirrorUrl(raw) : "";
    if (input) {
      input.value = normalized;
    }

    try {
      const { setConfig } = await import("../../../db/set-config.js");
      await setConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_URL, normalized);
      resetSharedModelCacheConfigCache();
      showSuccess(
        normalized
          ? "Shared Model Cache Mirror URL saved"
          : "Shared Model Cache Mirror URL cleared",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Error saving mirror URL: ${errorMsg}`, 6000);
    }
  }

  async handleSelectSharedModelDir() {
    if (!this.db) {
      return;
    }

    try {
      const selected = await selectSharedModelCacheDirectory(this.db);
      if (selected) {
        const [dirHandle, scopeVal] = await Promise.all([
          getConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_DIR_HANDLE),
          getConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_SCOPE),
        ]);
        const scope = scopeVal === "deployment" ? "deployment" : "origin";
        let exportSuffix = "";
        if (dirHandle) {
          const res = await exportBrowserModelsToSharedDir(dirHandle, scope);
          if (res.exportedFiles > 0) {
            exportSuffix = ` (${res.exportedFiles} cached files synced)`;
          }
        }
        showSuccess(`Shared Model Folder connected${exportSuffix}`, 3000);
        await this.updateStorageInfo();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to select Shared Model Folder: ${errorMsg}`, 6000);
    }
  }

  async handleSyncSharedModelDir() {
    if (!this.db) {
      return;
    }

    try {
      const [dirHandle, scopeVal] = await Promise.all([
        getConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_DIR_HANDLE),
        getConfig(this.db, CONFIG_KEYS.SHARED_MODEL_CACHE_SCOPE),
      ]);
      if (!dirHandle) {
        showWarning("Choose a Shared Model Folder first.", 3500);
        return;
      }
      const scope = scopeVal === "deployment" ? "deployment" : "origin";
      const res = await exportBrowserModelsToSharedDir(dirHandle, scope);
      showSuccess(
        `${res.exportedFiles} model files synced (${res.skippedFiles} already present)`,
        3500,
      );
      await this.updateStorageInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to sync cached models: ${errorMsg}`, 6000);
    }
  }

  async handleClearSharedModelDir() {
    if (!this.db) {
      return;
    }

    try {
      await resetSharedModelCacheDirectory(this.db);
      showSuccess("Shared Model Folder disconnected", 2500);
      await this.updateStorageInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to disconnect Shared Model Folder: ${errorMsg}`, 6000);
    }
  }

  async handleClearBrowserModelCache() {
    if (!this.db) {
      return;
    }

    const confirmed = await this.requestConfirmation({
      title: "Clear Browser Model Cache",
      message: "Remove downloaded AI model weights from browser CacheStorage?",
      confirmLabel: "Clear Cache",
      cancelLabel: "Cancel",
    });
    if (!confirmed) {
      return;
    }

    try {
      const scopeVal = await getConfig(
        this.db,
        CONFIG_KEYS.SHARED_MODEL_CACHE_SCOPE,
      );
      await clearBrowserModelCaches(
        scopeVal === "deployment" ? "deployment" : "origin",
      );
      showSuccess("Browser model cache cleared", 3000);
      await this.updateStorageInfo();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to clear browser model cache: ${errorMsg}`, 6000);
    }
  }
}

defineElement(elementName, ShadowClawStorage);
