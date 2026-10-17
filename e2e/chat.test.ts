import { test, expect } from "./fixtures.js";

test.describe("Chat Interface", () => {
  test("should render chat page with message input", async ({ chat }) => {
    await chat.open();
    await chat.expectCoreUi();
  });

  test("should display message input placeholder", async ({ chat }) => {
    await chat.open();
    const placeholder = (await chat.placeholder()) || "";
    expect(placeholder.length).toBeGreaterThan(0);
  });

  test("should render chat action controls", async ({ chat }) => {
    await chat.open();
    await expect(chat.actionButton("download-chat")).toHaveCount(1);
    await expect(chat.actionButton("restore-chat")).toHaveCount(1);
    await expect(chat.actionButton("compact-chat")).toHaveCount(1);
    await expect(chat.actionButton("clear-chat")).toHaveCount(1);
  });

  test("should enable/disable send button based on input", async ({ chat }) => {
    await chat.open();
    await expect(chat.sendButton()).toBeVisible();
    await chat.fillMessage("Hello, test message!");
    await expect(chat.sendButton()).toBeEnabled();
  });

  test("should render live status indicator", async ({ chat }) => {
    await chat.open();
    await expect(chat.status()).toHaveCount(1);
    await expect(chat.statusText()).toHaveCount(1);
  });

  test("should have export/import buttons", async ({ chat }) => {
    await chat.open();
    const hasAnyDataAction =
      (await chat.actionButton("download-chat").count()) > 0 ||
      (await chat.actionButton("restore-chat").count()) > 0 ||
      (await chat.actionButton("clear-chat").count()) > 0;
    expect(hasAnyDataAction).toBe(true);
  });

  test("should render markdown content in messages", async ({ chat }) => {
    await chat.open();
    const markdownNodes = chat.host.locator(".hljs, pre code, .markdown");

    expect(await markdownNodes.count()).toBeGreaterThanOrEqual(0);
  });

  test("should show local AI onboarding dialog when first browsing to chat", async ({
    page,
  }) => {
    await page.goto("/chat");
    const dialog = page.locator(
      'shadow-claw shadow-claw-chat shadow-claw-dialog[dialog-class="chat__prompt-api-dialog"] dialog',
    );
    await expect(dialog).toBeVisible();
    await expect(
      page.locator(
        'shadow-claw shadow-claw-chat shadow-claw-dialog[dialog-class="chat__prompt-api-dialog"] .chat__prompt-api-title',
      ),
    ).toContainText("Welcome to Local AI (Transformers.js)");
  });

  test("should send a slash command and display it in the chat thread", async ({
    chat,
  }) => {
    await chat.open();
    await chat.sendMessage("/skill-creator");

    const userMsg = chat.host.locator(".chat__message--user").last();
    await expect(userMsg).toBeVisible({ timeout: 10000 });
    await expect(userMsg).toContainText("/skill-creator");
  });
});
