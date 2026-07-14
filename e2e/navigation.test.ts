import { test, expect } from "./fixtures.js";

test.describe("Navigation & Routing", () => {
  test("should load the app and render shadow-claw element", async ({
    app,
  }) => {
    await expect(app.root).toHaveCount(1);
    await expect(app.activePage()).toHaveCount(1);
  });

  test("should navigate between pages (chat, files, tasks)", async ({
    app,
  }) => {
    const defaultPage = await app.currentPageId();

    expect(defaultPage).toBe("pages");

    await app.navigateTo("files");
    let currentPage = await app.currentPageId();

    expect(currentPage).toBe("files");

    await app.navigateTo("tasks");
    currentPage = await app.currentPageId();

    expect(currentPage).toBe("tasks");

    await app.navigateTo("chat");
    currentPage = await app.currentPageId();

    expect(currentPage).toBe("chat");
  });

  test("should have navigation buttons visible", async ({ app }) => {
    const navItems = app.navItems();

    expect(await navItems.count()).toBeGreaterThanOrEqual(3);
  });

  test("should persist current page across reload", async ({ app, page }) => {
    await app.navigateTo("files");
    let currentPage = await app.currentPageId();

    expect(currentPage).toBe("files");

    await page.reload();
    await app.waitForReady();

    currentPage = await app.currentPageId();

    expect(["files", "chat", "tasks"]).toContain(currentPage);
  });

  test("should mount the shared terminal into the active page slot", async ({
    app,
  }) => {
    await app.navigateTo("chat");
    const chatSlot = app
      .chatComponent()
      .locator("[data-terminal-slot] shadow-claw-terminal");
    await expect(chatSlot).toBeAttached();

    await app.navigateTo("files");
    const filesSlot = app
      .filesComponent()
      .locator("[data-terminal-slot] shadow-claw-terminal");
    await expect(filesSlot).toBeAttached();
  });

  test("should toggle activity-log-toggle visibility based on active page", async ({
    app,
  }) => {
    await app.navigateTo("files");
    const activityLogToggle = app.root.locator(".activity-log-toggle");
    await expect(activityLogToggle).toBeHidden();

    await app.navigateTo("chat");
    await expect(activityLogToggle).toBeHidden();
  });

  test("should toggle webvm-toggle visibility based on active page", async ({
    app,
  }) => {
    // Navigate to settings via event dispatcher
    await app.navigateToWithOpenDialog("settings");
    await expect(app.activePage()).toHaveAttribute("data-page-id", "settings");

    const webvmToggle = app.root.locator(".webvm-toggle");
    await expect(webvmToggle).toBeHidden();

    await app.navigateTo("files");
    await expect(webvmToggle).toBeVisible();

    await app.navigateTo("chat");
    await expect(webvmToggle).toBeVisible();
  });

  test("should navigate to channels page and back to settings", async ({
    app,
  }) => {
    // Navigate to settings
    await app.navigateToWithOpenDialog("settings");
    await expect(app.activePage()).toHaveAttribute("data-page-id", "settings");

    const settingsComponent = app.root.locator("shadow-claw-settings");

    // Click "Integrations" tab
    await settingsComponent.locator('[data-tab-target="integrations"]').click();

    // Expand "Messaging Channels" section
    const channelsDetails = settingsComponent.locator("details", {
      hasText: "Messaging Channels",
    });
    if ((await channelsDetails.getAttribute("open")) === null) {
      await channelsDetails.locator("summary").click();
    }

    // Click "Configure Channels"
    await settingsComponent
      .locator('[data-action="show-channels-config"]')
      .click();

    // Wait for the channels page to become active
    await expect(app.activePage()).toHaveAttribute("data-page-id", "channels");

    // Click "Back to Settings"
    const channelsComponent = app.root.locator("shadow-claw-channels");
    await channelsComponent.locator('[data-action="back-to-settings"]').click();

    // Wait for the settings page to become active again
    await expect(app.activePage()).toHaveAttribute("data-page-id", "settings");
  });
});
