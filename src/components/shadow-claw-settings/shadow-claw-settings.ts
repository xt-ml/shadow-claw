import "../settings/shadow-claw-accounts/shadow-claw-accounts.js";
import "../settings/shadow-claw-git/shadow-claw-git.js";
import "../settings/shadow-claw-llm/shadow-claw-llm.js";
import "../settings/shadow-claw-mcp-remote/shadow-claw-mcp-remote.js";
import "../settings/shadow-claw-notifications/shadow-claw-notifications.js";
import "../settings/shadow-claw-storage/shadow-claw-storage.js";
import "../settings/shadow-claw-webvm/shadow-claw-webvm.js";

import type { Orchestrator } from "../../orchestrator.js";
import type { ShadowClawDatabase } from "../../types.js";
import { getDb } from "../../db/db.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings";

/**
 * Parent settings component that composes the dedicated sub-components:
 *
 *  - <shadow-claw-llm>    — Provider, model, API key, assistant name
 *  - <shadow-claw-webvm>  — VM boot mode, timeout, host, relay
 *  - <shadow-claw-git>    — CORS proxy, PAT, author config
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
