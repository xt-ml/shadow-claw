import { expect, Locator, Page } from "@playwright/test";

import { AppPage } from "./app.page.js";

export class SettingsPage {
  app: AppPage;
  host: Locator;
  page: Page;

  constructor(app: AppPage) {
    this.app = app;
    this.page = app.page;
    this.host = app.root.locator("shadow-claw-settings");
  }

  apiKeyInput() {
    return this.llm().locator('[data-setting="api-key-input"]');
  }

  assistantNameInput() {
    return this.host.locator('[data-setting="assistant-name-input"]');
  }

  llm() {
    return this.host.locator("shadow-claw-llm");
  }

  maxIterationsInput() {
    return this.llm().locator('[data-setting="max-iterations-input"]');
  }

  modelSelect() {
    return this.llm().locator('[data-setting="model-select"]');
  }

  providerSelect() {
    return this.llm().locator('[data-setting="provider-select"]');
  }

  saveApiKeyButton() {
    return this.llm().locator('[data-action="save-llm-provider"]');
  }

  saveAssistantNameButton() {
    return this.host.locator('[data-action="save-assistant-name"]');
  }

  saveMaxIterationsButton() {
    return this.llm().locator('[data-action="save-max-iterations"]');
  }

  streamingToggle() {
    return this.llm().locator('[data-setting="streaming-toggle"]');
  }

  async expandAiSettings() {
    const aiTab = this.host.locator('[data-tab-target="ai"]');
    await aiTab.click();

    const details = this.host
      .locator('[data-tab-panel="ai"] details.settings-collapsible')
      .first();
    const openAttr = await details.getAttribute("open");
    if (openAttr === null) {
      await details.locator("summary").click();
    }
  }

  async expandModelProviderSettings() {
    const aiTab = this.host.locator('[data-tab-target="ai"]');
    await aiTab.click();

    const details = this.host
      .locator('[data-tab-panel="ai"] details.settings-collapsible')
      .nth(1);
    const openAttr = await details.getAttribute("open");
    if (openAttr === null) {
      await details.locator("summary").click();
    }
  }

  async open() {
    await this.app.root.locator('[data-action="show-settings"]').click();
    await expect(this.app.activePage()).toHaveAttribute(
      "data-page-id",
      "settings",
    );
  }
}
