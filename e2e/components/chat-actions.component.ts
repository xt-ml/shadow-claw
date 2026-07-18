import { expect, Locator } from "@playwright/test";

export class ChatActionsComponent {
  private readonly host: Locator;

  constructor(chatHost: Locator) {
    this.host = chatHost;
  }

  clearButton() {
    return this.host.locator('[data-action="clear-chat"]');
  }

  compactButton() {
    return this.host.locator('[data-action="compact-chat"]');
  }

  downloadButton() {
    return this.host.locator('[data-action="download-chat"]');
  }

  restoreButton() {
    return this.host.locator('[data-action="restore-chat"]');
  }

  async clearChat() {
    await this.clearButton().click();
  }

  async compactChat() {
    await this.compactButton().click();
  }

  async downloadChat() {
    await this.downloadButton().click();
  }

  async expectAllActionsPresent() {
    await expect(this.downloadButton()).toHaveCount(1);
    await expect(this.restoreButton()).toHaveCount(1);
    await expect(this.compactButton()).toHaveCount(1);
    await expect(this.clearButton()).toHaveCount(1);
  }
}
