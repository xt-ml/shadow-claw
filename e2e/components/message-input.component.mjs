import { expect } from "@playwright/test";

/**
 * Message input component - handles chat textarea and send button.
 */
export class MessageInputComponent {
  /**
   * @param {import('@playwright/test').Locator} chatHost - The shadow-claw-chat locator
   */
  constructor(chatHost) {
    this.host = chatHost;
  }

  textarea() {
    return this.host.locator(".chat__input, textarea").first();
  }

  sendButton() {
    return this.host.locator(".chat__send-btn").first();
  }

  async fill(text) {
    await this.textarea().fill(text);
  }

  async send() {
    await this.sendButton().click();
  }

  async fillAndSend(text) {
    await this.fill(text);
    await this.send();
  }

  async placeholder() {
    return this.textarea().getAttribute("placeholder");
  }

  async expectVisible() {
    await expect(this.textarea()).toBeVisible();
    await expect(this.sendButton()).toBeVisible();
  }

  async expectSendEnabled() {
    await expect(this.sendButton()).toBeEnabled();
  }

  async expectSendDisabled() {
    await expect(this.sendButton()).toBeDisabled();
  }
}
