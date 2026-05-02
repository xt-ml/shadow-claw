import { getDb } from "../../../db/db.js";
import { effect } from "../../../effect.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess } from "../../../toast.js";

import type { Orchestrator } from "../../../orchestrator.js";
import type { ShadowClawDatabase } from "../../../types.js";

import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-task-server";

/**
 * Settings sub-component for Task Server URL configuration.
 */
export class ShadowClawTaskServer extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawTaskServer.componentPath}/${elementName}.css`;
  static template = `${ShadowClawTaskServer.componentPath}/${elementName}.html`;

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
      .querySelector('[data-action="save-task-server-url"]')
      ?.addEventListener("click", () => {
        void this.saveTaskServerUrl();
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

    const input = root.querySelector(
      '[data-setting="task-server-url-input"]',
    ) as HTMLInputElement | null;
    if (input) {
      input.value = this.orchestrator.getTaskServerUrl();
    }
  }

  async saveTaskServerUrl() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="task-server-url-input"]',
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const url = input.value.trim();

    try {
      await this.orchestrator.setTaskServerUrl(this.db, url || "/schedule");
      showSuccess("Task Server URL saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Task Server URL: " + errorMsg, 6000);
    }
  }
}

customElements.define(elementName, ShadowClawTaskServer);
