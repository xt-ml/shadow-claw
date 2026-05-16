import "../settings/shadow-claw-accounts/shadow-claw-accounts.js";
import "../settings/shadow-claw-git/shadow-claw-git.js";
import "../settings/shadow-claw-integrations/shadow-claw-integrations.js";
import "../settings/shadow-claw-llm/shadow-claw-llm.js";
import "../settings/shadow-claw-mcp-remote/shadow-claw-mcp-remote.js";
import "../settings/shadow-claw-networking/shadow-claw-networking.js";
import "../settings/shadow-claw-notifications/shadow-claw-notifications.js";
import "../settings/shadow-claw-storage/shadow-claw-storage.js";
import "../settings/shadow-claw-task-server/shadow-claw-task-server.js";
import "../settings/shadow-claw-webvm/shadow-claw-webvm.js";
import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";
import "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js";

import { ASSISTANT_NAME, CONFIG_KEYS } from "../../config.js";
import type { Orchestrator } from "../../orchestrator.js";
import type { ShadowClawDatabase } from "../../types.js";
import { decryptValue, encryptValue } from "../../crypto.js";
import { getDb } from "../../db/db.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { showError, showInfo, showSuccess } from "../../toast.js";
import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings";

type ConfigEntryRecord = { key: string; value: unknown };
type PasswordPathSegment = string | number;

interface PlaintextPasswordEntry {
  key: string;
  path: PasswordPathSegment[];
  value: string;
}

interface SettingsBackupPayload {
  kind: "shadowclaw-settings-backup";
  version: 1;
  exportedAt: number;
  includePlaintextPasswords: boolean;
  configEntries: ConfigEntryRecord[];
  plaintextPasswords?: PlaintextPasswordEntry[];
}

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
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawSettings.componentPath}/${elementName}.css`;
  static template = `${ShadowClawSettings.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  orchestrator: Orchestrator | null = null;
  activeTab = "ai";
  pendingRestoreFile: File | null = null;

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
    this.orchestrator = orchestratorStore.orchestrator;

    await this.render();
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Bind the channels config button
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

    // Bind the tools config button
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

    // Bind tab controls
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

    // Set the deployed revision
    const revisionEl = root.querySelector('[data-info="deployed-revision"]');
    if (revisionEl) {
      const revision =
        document
          .querySelector('meta[name="revision"]')
          ?.getAttribute("content")
          ?.trim() || "";
      revisionEl.textContent = `Deployed revision: ${revision || "unknown"}`;
    }

    // Populate Assistant settings
    await this.populateAssistantSettings();
  }

  async populateAssistantSettings() {
    const root = this.shadowRoot;
    if (!root || !this.db) {
      return;
    }

    // Load assistant name
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
        this.orchestrator?.getAssistantName() ||
        orchestratorStore.orchestrator?.getAssistantName();

      nameInput.value =
        (typeof storedAssistantName === "string" && storedAssistantName) ||
        orchestratorName ||
        ASSISTANT_NAME;
    }

    // Load activity log disk logging toggle
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

    // Assistant settings
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

  closeDialog(selector: string) {
    this.getDialog(selector)?.close();
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

  openRestoreDialog(fileName: string) {
    const root = this.shadowRoot;
    const info = root?.querySelector('[data-info="restore-filename"]');
    if (info instanceof HTMLElement) {
      info.textContent = `Selected file: ${fileName}`;
    }

    this.showDialog(".settings__restore-dialog");
  }

  openClearDialog() {
    this.showDialog(".settings__clear-dialog");
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

  cloneConfigValue(value: unknown): unknown {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  async collectAndStripPasswordData(
    entries: ConfigEntryRecord[],
    includePlaintextPasswords: boolean,
  ): Promise<{
    configEntries: ConfigEntryRecord[];
    plaintextPasswords: PlaintextPasswordEntry[];
  }> {
    const nextEntries: ConfigEntryRecord[] = [];
    const plaintextPasswords: PlaintextPasswordEntry[] = [];

    for (const entry of entries) {
      const key = entry.key;

      if (key === CONFIG_KEYS.STORAGE_HANDLE) {
        continue;
      }

      if (key === CONFIG_KEYS.GIT_PASSWORD) {
        if (includePlaintextPasswords && typeof entry.value === "string") {
          const decrypted = await decryptValue(entry.value);
          if (decrypted) {
            plaintextPasswords.push({ key, path: [], value: decrypted });
          }
        }

        continue;
      }

      const value = this.cloneConfigValue(entry.value);

      if (key === CONFIG_KEYS.GIT_ACCOUNTS && Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          const account = value[i] as Record<string, unknown>;
          if (!account || typeof account !== "object") {
            continue;
          }

          const encryptedPassword = account.password;
          if (typeof encryptedPassword === "string" && encryptedPassword) {
            if (includePlaintextPasswords) {
              const decrypted = await decryptValue(encryptedPassword);
              if (decrypted) {
                plaintextPasswords.push({
                  key,
                  path: [i, "password"],
                  value: decrypted,
                });
              }
            }

            delete account.password;
          }
        }
      }

      if (key === CONFIG_KEYS.INTEGRATION_CONNECTIONS && Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          const record = value[i] as Record<string, unknown>;
          const credentialRef = record?.credentialRef as
            | Record<string, unknown>
            | undefined;

          const encryptedSecret = credentialRef?.encryptedSecret;
          if (typeof encryptedSecret === "string" && encryptedSecret) {
            if (includePlaintextPasswords) {
              const decrypted = await decryptValue(encryptedSecret);
              if (decrypted) {
                plaintextPasswords.push({
                  key,
                  path: [i, "credentialRef", "encryptedSecret"],
                  value: decrypted,
                });
              }
            }

            delete credentialRef.encryptedSecret;
          }
        }
      }

      if (key === CONFIG_KEYS.REMOTE_MCP_CONNECTIONS && Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          const record = value[i] as Record<string, unknown>;
          const credentialRef = record?.credentialRef as
            | Record<string, unknown>
            | undefined;

          const encryptedValue = credentialRef?.encryptedValue;
          if (typeof encryptedValue === "string" && encryptedValue) {
            if (includePlaintextPasswords) {
              const decrypted = await decryptValue(encryptedValue);
              if (decrypted) {
                plaintextPasswords.push({
                  key,
                  path: [i, "credentialRef", "encryptedValue"],
                  value: decrypted,
                });
              }
            }

            delete credentialRef.encryptedValue;
          }
        }
      }

      nextEntries.push({ key, value });
    }

    return { configEntries: nextEntries, plaintextPasswords };
  }

  applyPathValue(
    rootValue: unknown,
    path: PasswordPathSegment[],
    nextValue: string,
  ): unknown {
    if (path.length === 0) {
      return nextValue;
    }

    let current = rootValue as Record<string, unknown> | unknown[] | null;

    for (let i = 0; i < path.length - 1; i += 1) {
      const segment = path[i];
      if (typeof segment === "number") {
        if (!Array.isArray(current) || !current[segment]) {
          return rootValue;
        }

        current = current[segment] as Record<string, unknown>;
      } else {
        if (!current || typeof current !== "object") {
          return rootValue;
        }

        const next = (current as Record<string, unknown>)[segment];
        if (!next || typeof next !== "object") {
          return rootValue;
        }

        current = next as Record<string, unknown>;
      }
    }

    const leaf = path[path.length - 1];
    if (typeof leaf === "number") {
      if (!Array.isArray(current)) {
        return rootValue;
      }

      current[leaf] = nextValue;
    } else {
      if (!current || typeof current !== "object") {
        return rootValue;
      }

      (current as Record<string, unknown>)[leaf] = nextValue;
    }

    return rootValue;
  }

  async reapplyPlaintextPasswords(
    entries: ConfigEntryRecord[],
    plaintextPasswords: PlaintextPasswordEntry[],
  ): Promise<ConfigEntryRecord[]> {
    if (!plaintextPasswords.length) {
      return entries;
    }

    const byKey = new Map(entries.map((entry) => [entry.key, entry]));

    for (const secret of plaintextPasswords) {
      const encrypted = await encryptValue(secret.value);
      if (!encrypted) {
        continue;
      }

      const existing = byKey.get(secret.key);
      if (existing) {
        existing.value = this.applyPathValue(
          existing.value,
          secret.path,
          encrypted,
        );
      } else if (secret.path.length === 0) {
        byKey.set(secret.key, { key: secret.key, value: encrypted });
      }
    }

    return Array.from(byKey.values());
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
      const entries = await this.getAllConfigEntries();
      const transformed = await this.collectAndStripPasswordData(
        entries,
        includePlaintextPasswords,
      );

      const payload: SettingsBackupPayload = {
        kind: "shadowclaw-settings-backup",
        version: 1,
        exportedAt: Date.now(),
        includePlaintextPasswords,
        configEntries: transformed.configEntries,
        plaintextPasswords: includePlaintextPasswords
          ? transformed.plaintextPasswords
          : undefined,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

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

  parseBackupPayload(raw: string): SettingsBackupPayload {
    const parsed = JSON.parse(raw) as Partial<SettingsBackupPayload>;

    if (
      parsed?.kind !== "shadowclaw-settings-backup" ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.configEntries)
    ) {
      throw new Error("Invalid settings backup file");
    }

    const plaintextPasswords = Array.isArray(parsed.plaintextPasswords)
      ? parsed.plaintextPasswords.filter((entry) => {
          return (
            entry &&
            typeof entry.key === "string" &&
            Array.isArray(entry.path) &&
            typeof entry.value === "string"
          );
        })
      : [];

    return {
      kind: "shadowclaw-settings-backup",
      version: 1,
      exportedAt:
        typeof parsed.exportedAt === "number" ? parsed.exportedAt : Date.now(),
      includePlaintextPasswords: !!parsed.includePlaintextPasswords,
      configEntries: parsed.configEntries
        .filter((entry) => entry && typeof entry.key === "string")
        .map((entry) => ({ key: entry.key, value: entry.value })),
      plaintextPasswords,
    };
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
      const backup = this.parseBackupPayload(text);
      const mergedEntries = await this.reapplyPlaintextPasswords(
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
      const { showWarning } = await import("../../toast.js");
      showWarning("Please enter a name", 3000);

      return;
    }

    localStorage.setItem("assistantName", name);

    try {
      const orchestrator = this.orchestrator || orchestratorStore.orchestrator;
      if (orchestrator) {
        this.orchestrator = orchestrator;
        await orchestrator.setAssistantName(this.db, name);
      } else {
        const { setConfig } = await import("../../db/setConfig.js");
        await setConfig(this.db, CONFIG_KEYS.ASSISTANT_NAME, name);
      }
    } catch (e) {
      console.warn("Could not update orchestrator:", e);
    }

    showSuccess("Assistant name saved", 3000);
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

  applyTabState() {
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

  activateTab(tabId: string | undefined) {
    if (!tabId || this.activeTab === tabId) {
      return;
    }

    this.activeTab = tabId;
    this.applyTabState();
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
}

customElements.define(elementName, ShadowClawSettings);
