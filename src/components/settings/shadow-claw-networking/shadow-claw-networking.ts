import { getDb } from "../../../db/db.js";
import { effect } from "../../../effect.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess, showWarning } from "../../../toast.js";

import type { Orchestrator } from "../../../orchestrator.js";
import type { ShadowClawDatabase } from "../../../types.js";

import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-networking";

/**
 * Settings sub-component for network proxy configuration.
 */
export class ShadowClawNetworking extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawNetworking.componentPath}/${elementName}.css`;
  static template = `${ShadowClawNetworking.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null;
  orchestrator: Orchestrator | null;

  constructor() {
    super();

    this.db = null;
    this.orchestrator = null;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();
    this.orchestrator = orchestratorStore.orchestrator;

    this.bindEventListeners();
    this.setupEffects();
    await this.render();
  }

  setupEffects() {
    effect(() => {
      if (orchestratorStore.ready) {
        this.orchestrator = orchestratorStore.orchestrator;
        this.render();
      }
    });
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-setting="proxy-toggle"]')
      ?.addEventListener("change", (e) => {
        if (e.target instanceof HTMLInputElement) {
          void this.onProxyToggle(e.target.checked);
        }
      });

    root
      .querySelector('[data-action="save-proxy-url"]')
      ?.addEventListener("click", () => {
        void this.saveProxyUrl();
      });
  }

  async render() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const proxyToggle = root.querySelector(
      '[data-setting="proxy-toggle"]',
    ) as HTMLInputElement | null;
    if (proxyToggle) {
      proxyToggle.checked = this.orchestrator.getUseProxy();
    }

    const proxyUrlInput = root.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;
    if (proxyUrlInput) {
      proxyUrlInput.value = this.orchestrator.getProxyUrl();
    }
  }

  async onProxyToggle(enabled: boolean) {
    if (!this.orchestrator || !this.db) {
      return;
    }

    try {
      await this.orchestrator.setUseProxy(this.db, enabled);
      showSuccess(enabled ? "CORS Proxy enabled" : "CORS Proxy disabled", 2500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving proxy setting: " + errorMsg, 6000);
    }
  }

  async saveProxyUrl() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const url = input.value.trim();
    if (!url) {
      showWarning("Please enter a proxy URL (e.g. /proxy)", 3000);

      return;
    }

    try {
      await this.orchestrator.setProxyUrl(this.db, url);
      showSuccess("Proxy URL saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving proxy URL: " + errorMsg, 6000);
    }
  }
}

customElements.define(elementName, ShadowClawNetworking);
