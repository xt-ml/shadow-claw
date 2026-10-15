import { test, expect } from "./fixtures.js";
import { setupMockLlm } from "./shared/index.js";

test.describe("Agent Tool Calling Loop (E2E)", () => {
  test("executes write_file tool and displays confirmation in chat", async ({
    page,
    app,
    chat,
    files,
  }) => {
    const testFileName = `e2e-agent-file-${Date.now()}.txt`;
    const testContent = "Hello from automated agent tool execution!";

    // Setup multi-turn mock LLM:
    // Turn 1: LLM decides to call the write_file tool
    // Turn 2: LLM receives tool execution output and responds with confirmation
    await setupMockLlm(page, [
      {
        type: "tool_call",
        toolCalls: [
          {
            id: "call_write_1",
            name: "write_file",
            arguments: {
              path: testFileName,
              content: testContent,
            },
          },
        ],
      },
      {
        type: "text",
        text: `Created ${testFileName} successfully.`,
      },
    ]);

    await app.navigateTo("chat");
    await chat.expectCoreUi();

    // Send user message requesting file creation
    await chat.sendMessage(`Create a file named ${testFileName}`);

    // User message should appear
    await expect(
      chat.host.locator(".chat__message--user").last(),
    ).toContainText(testFileName, { timeout: 10000 });

    // Assistant final confirmation should appear
    const assistantMsg = chat.host
      .locator(".chat__message--assistant:not(.chat__message--streaming)")
      .last();
    await expect(assistantMsg).toBeVisible({ timeout: 15000 });
    await expect(assistantMsg).toContainText(
      `Created ${testFileName} successfully.`,
      {
        timeout: 15000,
      },
    );

    // Navigate to Files page and verify the file actually exists in the workspace
    await app.navigateTo("files");
    await files.open();

    const refreshBtn = files.host.locator(".files__refresh-btn");
    if ((await refreshBtn.count()) > 0) {
      await refreshBtn.click();
    }

    const fileItem = files.host.locator(
      `.files__item-main[aria-label="Open file ${testFileName}"]`,
    );
    await expect(fileItem).toBeVisible({ timeout: 10000 });
  });

  test("handles LLM error response gracefully in chat UI", async ({
    page,
    app,
    chat,
  }) => {
    // Setup mock LLM that returns a 429 Rate Limit error
    await setupMockLlm(page, [
      {
        type: "error",
        status: 429,
        message: "Rate limit exceeded. Please wait before retrying.",
      },
    ]);

    await app.navigateTo("chat");
    await chat.expectCoreUi();

    await chat.sendMessage("Will this fail?");

    // Verify user message was shown
    await expect(
      chat.host.locator(".chat__message--user").last(),
    ).toContainText("Will this fail?", { timeout: 10000 });

    // Check that an error state or error toast/dialog is surfaced and app does not crash
    await page.waitForTimeout(1000);
    const toast = app.toastComponent();
    expect(await toast.count()).toBeGreaterThanOrEqual(1);
  });
});
