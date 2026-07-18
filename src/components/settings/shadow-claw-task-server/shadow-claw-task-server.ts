import { effect } from "../../../core/effect.js";
import { getDb } from "../../../db/db.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess } from "../../../ui/toast.js";

import type { Orchestrator } from "../../../core/orchestrator/orchestrator.js";
import type { ShadowClawDatabase } from "../../../db/types.js";

import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawTaskServerStyles from "./shadow-claw-task-server.css" with { type: "css" };
import shadowClawTaskServerTemplate from "./shadow-claw-task-server.html" with { type: "html" };

const elementName = "shadow-claw-task-server";

/**
 * Settings sub-component for Task Server URL configuration.
 */
export class ShadowClawTaskServer extends ShadowClawElement {
  static styles = shadowClawTaskServerStyles;
  static template = shadowClawTaskServerTemplate;

  db: ShadowClawDatabase | null;
  orchestrator: Orchestrator | null;

  constructor() {
    super();

    this.db = null;
    this.orchestrator = null;
  }

  async connectedCallback() {
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

  setupEffects() {
    effect(() => {
      if (orchestratorStore.ready) {
        this.orchestrator = orchestratorStore.orchestrator;
        this.render();
      }
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

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawTaskServer);
}
