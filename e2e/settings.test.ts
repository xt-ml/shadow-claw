import { test, expect } from "./fixtures.js";

/**
 * Tier 1 E2E: Settings Persistence
 *
 * Change a setting → reload → verify it persisted
 */
test.describe("Settings Persistence", () => {
  test("should navigate to settings page", async ({ settings }) => {
    await settings.open();
    await expect(settings.host).toHaveCount(1);
  });

  test("should persist max iterations after reload", async ({
    page,
    app,
    settings,
  }) => {
    await settings.open();
    await settings.expandModelProviderSettings();

    const input = settings.maxIterationsInput();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Clear and set a new value
    await input.fill("75");
    await settings.saveMaxIterationsButton().click();

    // Wait for save to complete
    await page.waitForTimeout(1000);

    // Reload the page
    await page.reload();
    await app.waitForReady();

    // Navigate back to settings
    await settings.open();
    await settings.expandModelProviderSettings();

    // Verify the value persisted
    await expect(settings.maxIterationsInput()).toHaveValue("75", {
      timeout: 10000,
    });
  });

  test("should persist streaming toggle after reload", async ({
    page,
    app,
    settings,
  }) => {
    await settings.open();
    await settings.expandModelProviderSettings();

    const toggle = settings.streamingToggle();
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Read current state
    const wasChecked = await toggle.isChecked();

    // Toggle it
    await toggle.click();

    // Verify it changed
    if (wasChecked) {
      await expect(toggle).not.toBeChecked();
    } else {
      await expect(toggle).toBeChecked();
    }

    // Wait for save (streaming toggle auto-saves on change)
    await page.waitForTimeout(1000);

    // Reload
    await page.reload();
    await app.waitForReady();

    // Navigate back to settings
    await settings.open();
    await settings.expandModelProviderSettings();

    // Verify the state persisted (opposite of original)
    if (wasChecked) {
      await expect(settings.streamingToggle()).not.toBeChecked({
        timeout: 10000,
      });
    } else {
      await expect(settings.streamingToggle()).toBeChecked({ timeout: 10000 });
    }
  });

  test("should persist assistant name after reload", async ({
    page,
    app,
    settings,
  }) => {
    await settings.open();
    await settings.expandAiSettings();

    const input = settings.assistantNameInput();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Set a unique name
    await input.fill("TestBot");
    await settings.saveAssistantNameButton().click();

    // Wait for save
    await page.waitForTimeout(1000);

    // Reload
    await page.reload();
    await app.waitForReady();

    // Navigate back to settings
    await settings.open();
    await settings.expandAiSettings();

    // Verify persisted
    await expect(settings.assistantNameInput()).toHaveValue("TestBot", {
      timeout: 10000,
    });
  });
});
