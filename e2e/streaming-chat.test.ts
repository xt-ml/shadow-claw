import { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";

test.describe("Chat Flow with Streaming", () => {
  async function setupMockProvider(
    page: Page,
    app: any,
    { streaming = true } = {},
  ) {
    const providerUrl = "https://openrouter.ai/api/v1/chat/completions";

    // Set up route interception BEFORE configuring (requests go out after send)
    if (streaming) {
      await page.route(providerUrl, async (route) => {
        const sseBody = [
          `data: ${JSON.stringify({ id: "gen-mock", choices: [{ delta: { role: "assistant", content: "" }, index: 0 }], model: "test" })}\n\n`,
          `data: ${JSON.stringify({ id: "gen-mock", choices: [{ delta: { content: "Hello" }, index: 0 }], model: "test" })}\n\n`,
          `data: ${JSON.stringify({ id: "gen-mock", choices: [{ delta: { content: " from" }, index: 0 }], model: "test" })}\n\n`,
          `data: ${JSON.stringify({ id: "gen-mock", choices: [{ delta: { content: " ShadowClaw" }, index: 0 }], model: "test" })}\n\n`,
          `data: ${JSON.stringify({ id: "gen-mock", choices: [{ delta: { content: "!" }, index: 0, finish_reason: "stop" }], model: "test", usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })}\n\n`,
          "data: [DONE]\n\n",
        ].join("");

        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sseBody,
        });
      });
    } else {
      await page.route(providerUrl, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "gen-mock",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Hello from ShadowClaw!",
                },
                finish_reason: "stop",
                index: 0,
              },
            ],
            model: "test",
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
        });
      });
    }

    // Wait for the app to initialize and expose globals
    await page.waitForFunction(
      () =>
        (globalThis as any).orchestratorStore?.orchestrator &&
        (globalThis as any).__SHADOWCLAW_DB__,
      { timeout: 15000 },
    );

    // Use the exposed globals to configure provider + API key with encryption
    await page.evaluate(
      async ({ streaming }) => {
        const store = (globalThis as any).orchestratorStore;
        const db = (globalThis as any).__SHADOWCLAW_DB__;

        // Set provider and model via orchestrator directly
        await store.orchestrator.setProvider(db, "openrouter");
        await store.orchestrator.setApiKey(db, "fake-test-key-12345");
        await store.orchestrator.setModel(db, "test/mock-model");
        await store.orchestrator.setStreamingEnabled(db, streaming);
      },
      { streaming },
    );
  }

  test("should send a message and see a streaming response", async ({
    page,
    app,
    chat,
  }) => {
    await setupMockProvider(page, app, { streaming: true });

    await app.navigateTo("chat");
    await chat.expectCoreUi();

    // Count initial messages
    const initialCount = await chat.host.locator(".chat__message").count();

    // Send a message
    await chat.sendMessage("Hello, test!");

    // User message should appear
    const userMsg = chat.host.locator(".chat__message--user").last();
    await expect(userMsg).toBeVisible({ timeout: 10000 });
    await expect(userMsg).toContainText("Hello, test!");

    // Wait for the assistant's final response to appear
    await expect(
      chat.host.locator(".chat__message--assistant").last(),
    ).toBeVisible({ timeout: 15000 });

    // Verify the assistant response contains expected text
    await expect(
      chat.host.locator(".chat__message--assistant").last(),
    ).toContainText("Hello from ShadowClaw", { timeout: 15000 });

    // At least 2 new messages (user + assistant)
    const finalCount = await chat.host.locator(".chat__message").count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 2);
  });

  test("should send a message and get non-streaming response", async ({
    page,
    app,
    chat,
  }) => {
    await setupMockProvider(page, app, { streaming: false });

    await app.navigateTo("chat");
    await chat.expectCoreUi();

    await chat.sendMessage("Hello, non-streaming test!");

    // User message should appear
    await expect(
      chat.host.locator(".chat__message--user").last(),
    ).toContainText("Hello, non-streaming test!", { timeout: 10000 });

    // Wait for assistant response
    await expect(
      chat.host.locator(".chat__message--assistant").last(),
    ).toContainText("Hello from ShadowClaw", { timeout: 15000 });
  });

  test("should display user message immediately after sending", async ({
    page,
    app,
    chat,
  }) => {
    await setupMockProvider(page, app, { streaming: false });

    await app.navigateTo("chat");
    await chat.expectCoreUi();

    await chat.fillMessage("My test message");
    await expect(chat.sendButton()).toBeEnabled();

    await chat.sendMessage("My test message");

    // User message should render with the sent text
    await expect(
      chat.host.locator(".chat__message--user").last(),
    ).toContainText("My test message", { timeout: 10000 });
  });
});
