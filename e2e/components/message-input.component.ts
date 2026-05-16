import { expect, Locator } from "@playwright/test";

export class MessageInputComponent {
  private readonly host: Locator;

  constructor(chatHost: Locator) {
    this.host = chatHost;
  }

  textarea(): Locator {
    return this.host.locator(".chat__input, textarea").first();
  }

  sendButton(): Locator {
    return this.host.locator(".chat__send-btn").first();
  }

  attachButton(): Locator {
    return this.host.locator(".chat__attach-btn").first();
  }

  async fill(text: string): Promise<void> {
    await this.textarea().fill(text);
  }

  async send(): Promise<void> {
    await this.sendButton().click();
  }

  async attach(): Promise<void> {
    await this.attachButton().click();
  }

  async fillAndSend(text: string): Promise<void> {
    await this.fill(text);
    await this.send();
  }

  async placeholder(): Promise<string | null> {
    return this.textarea().getAttribute("placeholder");
  }

  async expectVisible(): Promise<void> {
    await expect(this.textarea()).toBeVisible();
    await expect(this.sendButton()).toBeVisible();
  }

  async expectSendEnabled(): Promise<void> {
    await expect(this.sendButton()).toBeEnabled();
  }

  async expectSendDisabled(): Promise<void> {
    await expect(this.sendButton()).toBeDisabled();
  }
}
