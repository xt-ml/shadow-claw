import { expect } from "@playwright/test";
import { MessageInputComponent } from "../components/message-input.component.mjs";
import { ChatActionsComponent } from "../components/chat-actions.component.mjs";

/**
 * Chat page object with intent-driven operations.
 */
export class ChatPage {
  /** @param {import('./app.page.mjs').AppPage} app */
  constructor(app) {
    this.app = app;
    this.page = app.page;
    this.host = app.chatComponent();
    this.messageInput = new MessageInputComponent(this.host);
    this.actions = new ChatActionsComponent(this.host);
  }

  async open() {
    await this.app.navigateTo("chat");
    await expect(this.host).toHaveCount(1);
  }

  // Expose component methods for backward compatibility
  input() {
    return this.messageInput.textarea();
  }

  sendButton() {
    return this.messageInput.sendButton();
  }

  messages() {
    return this.host.locator(".message");
  }

  status() {
    return this.host.locator(".chat__status");
  }

  statusText() {
    return this.host.locator(".chat__status-text");
  }

  actionButton(action) {
    return this.host.locator(`[data-action="${action}"]`).first();
  }

  async fillMessage(text) {
    await this.messageInput.fill(text);
  }

  async sendMessage(text) {
    await this.messageInput.fillAndSend(text);
  }

  async placeholder() {
    return this.messageInput.placeholder();
  }

  async messageCount() {
    return this.messages().count();
  }

  async expectCoreUi() {
    await this.messageInput.expectVisible();
    await expect(this.host.locator(".chat__messages")).toHaveCount(1);
  }
}
