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
    const details = this.host.locator(
      'details:has(summary:has-text("AI Model & Provider"))',
    );
    const openAttr = await details.getAttribute("open");
    if (openAttr === null) {
      await details.locator("summary").click();
    }
  }

  llm() {
    return this.host.locator("shadow-claw-llm");
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
    return this.llm().locator('[data-setting="assistant-name-input"]');
  }

  saveAssistantNameButton() {
    return this.llm().locator('[data-action="save-assistant-name"]');
  }
}
