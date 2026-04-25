import { expect, Locator } from "@playwright/test";

export class ChatActionsComponent {
  private readonly host: Locator;

  constructor(chatHost: Locator) {
    this.host = chatHost;
  }

  downloadButton() {
    return this.host.locator('[data-action="download-chat"]');
  }

  restoreButton() {
    return this.host.locator('[data-action="restore-chat"]');
  }

  compactButton() {
    return this.host.locator('[data-action="compact-chat"]');
  }

  clearButton() {
    return this.host.locator('[data-action="clear-chat"]');
  }

  async expectAllActionsPresent() {
    await expect(this.downloadButton()).toHaveCount(1);
    await expect(this.restoreButton()).toHaveCount(1);
    await expect(this.compactButton()).toHaveCount(1);
    await expect(this.clearButton()).toHaveCount(1);
  }

  async downloadChat() {
    await this.downloadButton().click();
  }

  async clearChat() {
    await this.clearButton().click();
  }

  async compactChat() {
    await this.compactButton().click();
  }
}
