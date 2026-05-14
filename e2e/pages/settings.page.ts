import { expect, Locator, Page } from "@playwright/test";

import { AppPage } from "./app.page.js";

export class SettingsPage {
  app: AppPage;
  page: Page;
  host: Locator;

  constructor(app: AppPage) {
    this.app = app;
    this.page = app.page;
    this.host = app.root.locator("shadow-claw-settings");
  }

  async open() {
    await this.app.root.locator('[data-action="show-settings"]').click();
    await expect(this.app.activePage()).toHaveAttribute(
      "data-page-id",
      "settings",
    );
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

  llm() {
    return this.host.locator('shadow-claw-llm[data-view="model-provider"]');
  }

  aiLlm() {
    return this.host.locator('shadow-claw-llm[data-view="ai"]');
  }

  maxIterationsInput() {
    return this.llm().locator('[data-setting="max-iterations-input"]');
  }

  saveMaxIterationsButton() {
    return this.llm().locator('[data-action="save-max-iterations"]');
  }

  streamingToggle() {
    return this.llm().locator('[data-setting="streaming-toggle"]');
  }

  providerSelect() {
    return this.llm().locator('[data-setting="provider-select"]');
  }

  modelSelect() {
    return this.llm().locator('[data-setting="model-select"]');
  }

  apiKeyInput() {
    return this.llm().locator('[data-setting="api-key-input"]');
  }

  saveApiKeyButton() {
    return this.llm().locator('[data-action="save-api-key"]');
  }

  assistantNameInput() {
    return this.aiLlm().locator('[data-setting="assistant-name-input"]');
  }

  saveAssistantNameButton() {
    return this.aiLlm().locator('[data-action="save-assistant-name"]');
  }
}
