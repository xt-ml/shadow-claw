import { expect, Locator, Page } from "@playwright/test";
import { MessageInputComponent } from "../components/message-input.component.js";
import { ChatActionsComponent } from "../components/chat-actions.component.js";
import { AppPage } from "./app.page.js";

/**
 * Chat page object with intent-driven operations.
 */
export class ChatPage {
  actions: ChatActionsComponent;
  app: AppPage;
  host: Locator;
  messageInput: MessageInputComponent;
  page: Page;

  constructor(app: AppPage) {
    this.app = app;
    this.page = app.page;
    this.host = app.chatComponent();
    this.messageInput = new MessageInputComponent(this.host);
    this.actions = new ChatActionsComponent(this.host);
  }

  actionButton(action: string) {
    return this.host.locator(`[data-action="${action}"]`).first();
  }

  input() {
    return this.messageInput.textarea();
  }

  messages() {
    return this.host.locator(".message");
  }

  sendButton() {
    return this.messageInput.sendButton();
  }

  status() {
    return this.host.locator(".chat__status");
  }

  statusText() {
    return this.host.locator(".chat__status-text");
  }

  async expectCoreUi() {
    await this.messageInput.expectVisible();
    await expect(this.host.locator(".chat__messages")).toHaveCount(1);
  }

  async fillMessage(text: string) {
    await this.messageInput.fill(text);
  }

  async messageCount() {
    return this.messages().count();
  }

  async open() {
    await this.app.navigateTo("chat");
    await expect(this.host).toHaveCount(1);
  }

  async placeholder() {
    return this.messageInput.placeholder();
  }

  async sendMessage(text: string) {
    await this.messageInput.fillAndSend(text);
  }
}
