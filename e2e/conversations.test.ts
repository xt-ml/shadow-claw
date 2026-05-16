import { test, expect } from "./fixtures.js";

test.describe("Conversation CRUD", () => {
  test("should show at least one default conversation", async ({
    conversations,
  }) => {
    await expect(conversations.items().first()).toBeVisible({ timeout: 10000 });
    expect(await conversations.count()).toBeGreaterThanOrEqual(1);
  });

  test("should create a new conversation", async ({ conversations }) => {
    const initialCount = await conversations.count();

    await conversations.createConversation("Test Conversation");

    // Wait for the new conversation to appear
    await conversations.expectCount(initialCount + 1);

    // The new conversation should be active
    const activeName = await conversations.activeConversationName();
    expect(activeName).toContain("Test Conversation");
  });

  test("should rename a conversation", async ({ conversations }) => {
    // First create a conversation to rename
    await conversations.createConversation("Original Name");
    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: "Original Name",
      }),
    ).toBeVisible({ timeout: 5000 });

    // Find the conversation item with "Original Name"
    const item = conversations.items().filter({ hasText: "Original Name" });

    await conversations.editConversationDetails(item, "Renamed Convo");

    // Verify the name changed
    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: "Renamed Convo",
      }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should switch between conversations", async ({ conversations }) => {
    // Create a second conversation
    await conversations.createConversation("Second Convo");

    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: "Second Convo",
      }),
    ).toBeVisible({ timeout: 5000 });

    // The newly created conversation should be active
    let activeName = await conversations.activeConversationName();
    expect(activeName).toContain("Second Convo");

    // Click the first conversation to switch
    const firstItem = conversations.items().first();
    await firstItem.click();

    // Verify a different conversation is now active
    await expect(conversations.activeItem()).not.toContainText("Second Convo", {
      timeout: 5000,
    });
  });

  test("should delete a conversation", async ({ conversations }) => {
    // Create a conversation to delete
    await conversations.createConversation("To Delete");

    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: "To Delete",
      }),
    ).toBeVisible({ timeout: 5000 });

    const countBeforeDelete = await conversations.count();

    // Find the conversation and delete it
    const item = conversations.items().filter({ hasText: "To Delete" });

    await conversations.deleteConversation(item, true);

    // Verify the conversation was removed
    await conversations.expectCount(countBeforeDelete - 1);

    // Verify the deleted conversation is gone
    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: "To Delete",
      }),
    ).toHaveCount(0);
  });

  test("should cancel delete when dismissing confirm dialog", async ({
    conversations,
  }) => {
    // Create a conversation
    await conversations.createConversation("Keep Me");

    await expect(
      conversations.host().locator(".conversation-name", {
        hasText: "Keep Me",
      }),
    ).toBeVisible({ timeout: 5000 });

    const countBefore = await conversations.count();

    const item = conversations.items().filter({ hasText: "Keep Me" });

    await conversations.deleteConversation(item, false);

    // Conversation should still exist
    await conversations.expectCount(countBefore);
  });
});
