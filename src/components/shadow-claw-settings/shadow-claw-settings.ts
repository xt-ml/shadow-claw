import "../shadow-claw-settings-accounts/shadow-claw-settings-accounts.js";
import "../shadow-claw-settings-git/shadow-claw-settings-git.js";
import "../shadow-claw-settings-llm/shadow-claw-settings-llm.js";
import "../shadow-claw-settings-mcp-remote/shadow-claw-settings-mcp-remote.js";
import "../shadow-claw-settings-notifications/shadow-claw-settings-notifications.js";
import "../shadow-claw-settings-storage/shadow-claw-settings-storage.js";
import "../shadow-claw-settings-webvm/shadow-claw-settings-webvm.js";

import type { Orchestrator } from "../../orchestrator.js";
import type { ShadowClawDatabase } from "../../types.js";
import { getDb } from "../../db/db.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings";

/**
 * Parent settings component that composes the dedicated sub-components:
 *
 *  - <shadow-claw-settings-llm>    — Provider, model, API key, assistant name
 *  - <shadow-claw-settings-webvm>  — VM boot mode, timeout, host, relay
 *  - <shadow-claw-settings-git>    — CORS proxy, PAT, author config
 *  - <shadow-claw-settings-storage>— OPFS, persistent, directory
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
  }
}

customElements.define(elementName, ShadowClawSettings);
