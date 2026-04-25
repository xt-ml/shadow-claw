import {
  BASH_DEFAULT_TIMEOUT_SEC,
  BASH_MAX_TIMEOUT_SEC,
  CONFIG_KEYS,
  DEFAULT_VM_BOOT_HOST,
} from "../../config.js";

import { getConfig } from "../../db/getConfig.js";
import { showError, showSuccess, showWarning } from "../../toast.js";
import type { ShadowClawDatabase } from "../../types.js";
import type { Orchestrator } from "../../orchestrator.js";
import { getDb } from "../../db/db.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { effect } from "../../effect.js";

import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings-webvm";

/**
 * Settings sub-component for WebVM configuration:
 * boot mode, bash timeout, boot host, network relay URL.
 */
export class ShadowClawSettingsWebvm extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawSettingsWebvm.componentPath}/${elementName}.css`;
  static template = `${ShadowClawSettingsWebvm.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  orchestrator: Orchestrator | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.bindEventListeners();
    this.setupEffects();
  }

  /**
   * Set up reactive effects.
   */
  setupEffects() {
    effect(() => {
      if (orchestratorStore.ready) {
        void (async () => {
          this.db = await getDb();
          this.orchestrator = orchestratorStore.orchestrator;
          await this.render();
        })();
      }
    });
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
      .querySelector('[data-action="save-vm-boot-mode"]')
      ?.addEventListener("click", () => this.saveVMBootMode());

    root
      .querySelector('[data-action="save-vm-bash-timeout"]')
      ?.addEventListener("click", () => this.saveVMBashTimeout());

    root
      .querySelector('[data-action="save-vm-boot-host"]')
      ?.addEventListener("click", () => this.saveVMBootHost());

    root
      .querySelector('[data-action="save-vm-network-relay-url"]')
      ?.addEventListener("click", () => this.saveVMNetworkRelayURL());
  }

  /**
   * Load and populate all WebVM settings fields.
   */
  async render() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    try {
      // Boot mode
      const vmBootModeSelect = root.querySelector(
        '[data-setting="vm-boot-mode-select"]',
      ) as HTMLSelectElement | null;
      const vmBootMode = await getConfig(this.db, CONFIG_KEYS.VM_BOOT_MODE);
      const normalizedVMBootMode =
        vmBootMode === "disabled" ||
        vmBootMode === "9p" ||
        vmBootMode === "ext2" ||
        vmBootMode === "auto"
          ? vmBootMode
          : "disabled";
      if (vmBootModeSelect) {
        vmBootModeSelect.value = normalizedVMBootMode;
      }

      // Bash timeout
      const vmBashTimeoutInput = root.querySelector(
        '[data-setting="vm-bash-timeout-input"]',
      ) as HTMLInputElement | null;
      const vmBashTimeoutRaw = await getConfig(
        this.db,
        CONFIG_KEYS.VM_BASH_TIMEOUT_SEC,
      );
      const vmBashTimeoutParsed = Number(vmBashTimeoutRaw);
      const normalizedVMBashTimeout = Number.isFinite(vmBashTimeoutParsed)
        ? Math.min(
            Math.max(Math.floor(vmBashTimeoutParsed), 1),
            BASH_MAX_TIMEOUT_SEC,
          )
        : BASH_DEFAULT_TIMEOUT_SEC;
      if (vmBashTimeoutInput) {
        vmBashTimeoutInput.value = String(normalizedVMBashTimeout);
      }

      // Boot host
      const vmBootHostInput = root.querySelector(
        '[data-setting="vm-boot-host-input"]',
      ) as HTMLInputElement | null;
      const vmBootHostRaw = await getConfig(this.db, CONFIG_KEYS.VM_BOOT_HOST);
      if (vmBootHostInput) {
        vmBootHostInput.value =
          typeof vmBootHostRaw === "string"
            ? vmBootHostRaw.trim()
            : DEFAULT_VM_BOOT_HOST;
      }

      // Network relay URL
      const vmNetworkRelayURLInput = root.querySelector(
        '[data-setting="vm-network-relay-url-input"]',
      ) as HTMLInputElement | null;
      const vmNetworkRelayURLRaw = await getConfig(
        this.db,
        CONFIG_KEYS.VM_NETWORK_RELAY_URL,
      );
      if (vmNetworkRelayURLInput && typeof vmNetworkRelayURLRaw === "string") {
        vmNetworkRelayURLInput.value = vmNetworkRelayURLRaw.trim();
      }
    } catch (e) {
      console.warn("Could not load WebVM settings:", e);
    }
  }

  /**
   * Save VM boot mode.
   */
  async saveVMBootMode() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const select = root.querySelector(
      '[data-setting="vm-boot-mode-select"]',
    ) as HTMLSelectElement | null;
    const selected = select?.value || "disabled";
    const mode =
      selected === "disabled" ||
      selected === "9p" ||
      selected === "ext2" ||
      selected === "auto"
        ? selected
        : "disabled";

    try {
      await this.orchestrator.setVMBootMode(this.db, mode);
      showSuccess("WebVM boot mode saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving WebVM mode: " + errorMsg, 6000);
    }
  }

  /**
   * Save default bash timeout.
   */
  async saveVMBashTimeout() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="vm-bash-timeout-input"]',
    ) as HTMLInputElement | null;
    const parsed = Number(input?.value);

    if (!Number.isFinite(parsed)) {
      showWarning("Please enter a valid timeout in seconds", 3000);

      return;
    }

    const normalized = Math.min(
      Math.max(Math.floor(parsed), 1),
      BASH_MAX_TIMEOUT_SEC,
    );
    if (input) {
      input.value = String(normalized);
    }

    try {
      await this.orchestrator.setVMBashTimeout(this.db, normalized);
      showSuccess("WebVM bash timeout saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving WebVM bash timeout: " + errorMsg, 6000);
    }
  }

  /**
   * Save boot host URL.
   */
  async saveVMBootHost() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="vm-boot-host-input"]',
    ) as HTMLInputElement | null;
    const value = input?.value?.trim() || "";

    if (value) {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("Boot host must use http:// or https://");
        }
      } catch {
        showWarning("Please enter a valid HTTP(S) boot host URL", 3500);

        return;
      }
    }

    try {
      await this.orchestrator.setVMBootHost(this.db, value);
      showSuccess("WebVM boot host saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving WebVM boot host: " + errorMsg, 6000);
    }
  }

  /**
   * Save network relay URL.
   */
  async saveVMNetworkRelayURL() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="vm-network-relay-url-input"]',
    ) as HTMLInputElement | null;
    const value = input?.value?.trim() || "";

    if (value) {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
          throw new Error("Relay URL must use ws:// or wss://");
        }
      } catch {
        showWarning("Please enter a valid ws:// or wss:// relay URL", 3500);

        return;
      }
    }

    if (input) {
      input.value = value;
    }

    try {
      await this.orchestrator.setVMNetworkRelayURL(this.db, value);
      showSuccess("WebVM relay URL saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving WebVM relay URL: " + errorMsg, 6000);
    }
  }
}

customElements.define(elementName, ShadowClawSettingsWebvm);
