import { CONFIG_KEYS } from "../../../config.js";
import { getConfig } from "../../../db/getConfig.js";

import { effect } from "../../../effect.js";

import { getStorageEstimate } from "../../../storage/getStorageEstimate.js";
import { isPersistent } from "../../../storage/isPersistent.js";
import { requestPersistentStorage } from "../../../storage/requestPersistentStorage.js";
import { resetStorageDirectory } from "../../../storage/storage.js";
import { selectStorageDirectory } from "../../../storage/selectStorageDirectory.js";

import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess, showWarning } from "../../../toast.js";

import type { ShadowClawDatabase } from "../../../types.js";
import { getDb } from "../../../db/db.js";
import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-storage";

/**
 * Settings sub-component for Storage configuration:
 * usage display, persistent storage, directory selection.
 */
export class ShadowClawStorage extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawStorage.componentPath}/${elementName}.css`;
  static template = `${ShadowClawStorage.componentPath}/${elementName}.html`;

  public db: ShadowClawDatabase | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

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
      .querySelector('[data-action="grant-storage-permission"]')
      ?.addEventListener("click", () => {
        if (this.db) {
          orchestratorStore.grantStorageAccess(this.db);
        }
      });
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
        helpGeneralEl.innerHTML = handle
          ? `Persistent storage protects your <b>chat history, tasks, and settings</b> in the browser database.
            Without it, the browser might clear this data if your disk is almost full.`
          : `Persistent storage protects your <b>files, chat history, and settings</b> in the browser.
            Without it, the browser might clear your data if your disk is almost full.`;
      }

      if (helpLocalEl) {
        helpLocalEl.innerHTML = handle
          ? `ShadowClaw is currently <b>connected to a local folder</b>. Your files are safe on your disk,
            but browser persistence is still recommended for your chat history.`
          : `You can use a local folder on your computer for storage. This makes files directly accessible
            on your disk and independent of browser storage limits.`;
      }

      // Disable persistent button if already persistent
      const requestPersistentBtn = root.querySelector(
        '[data-action="request-persistent"]',
      ) as HTMLButtonElement | null;
      if (requestPersistentBtn) {
        requestPersistentBtn.disabled = persistent;
      }
    } catch (err) {
      console.warn("Failed to update storage info:", err);
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

  /**
   * Handle changing storage directory.
   */
  async handleChangeStorageDir() {
    if (!this.db) {
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

  async requestConfirmation(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> {
    const appShell = document.querySelector("shadow-claw") as any;
    if (appShell && typeof appShell.requestDialog === "function") {
      return await appShell.requestDialog({ mode: "confirm", ...options });
    }

    showWarning(options.message, 4500);

    return false;
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
}

customElements.define(elementName, ShadowClawStorage);
