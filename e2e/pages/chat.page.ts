import { expect, Locator, Page } from "@playwright/test";
import { MessageInputComponent } from "../components/message-input.component.js";
import { ChatActionsComponent } from "../components/chat-actions.component.js";
import { AppPage } from "./app.page.js";

/**
 * Chat page object with intent-driven operations.
 */
export class ChatPage {
  app: AppPage;
  page: Page;
  host: Locator;
  messageInput: MessageInputComponent;
  actions: ChatActionsComponent;

  constructor(app: AppPage) {
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

  actionButton(action: string) {
    return this.host.locator(`[data-action="${action}"]`).first();
  }

  async fillMessage(text: string) {
    await this.messageInput.fill(text);
  }

  async sendMessage(text: string) {
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
