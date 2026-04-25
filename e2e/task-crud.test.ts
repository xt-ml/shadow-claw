import { test, expect } from "./fixtures.js";

test.describe("Task CRUD", () => {
  test("should open add task dialog", async ({ tasks }) => {
    await tasks.open();

    const addBtn = tasks.host.locator(".tasks__add-btn");
    await expect(addBtn).toBeVisible({ timeout: 10000 });

    await addBtn.click();

    // Dialog should be open
    const dialog = tasks.host.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog has expected fields
    await expect(tasks.host.locator("#tasksScheduleInput")).toBeVisible();
    await expect(tasks.host.locator("#tasksPromptInput")).toBeVisible();
  });

  test("should create a new task and see it in the list", async ({ tasks }) => {
    await tasks.open();

    // Open the add task dialog
    await tasks.host.locator(".tasks__add-btn").click();
    const dialog = tasks.host.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill in the schedule and prompt
    await tasks.host.locator("#tasksScheduleInput").fill("0 9 * * *");
    await tasks.host.locator("#tasksPromptInput").fill("Run daily check");

    // Submit the form
    await tasks.host.locator(".tasks__btn-save").click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Task should appear in the list
    const taskList = tasks.host.locator(".tasks__list");
    await expect(taskList.locator(".tasks__item")).toHaveCount(1, {
      timeout: 5000,
    });

    // Verify the task details are shown
    await expect(taskList).toContainText("0 9 * * *");
    await expect(taskList).toContainText("Run daily check");
  });

  test("should delete a task after confirming", async ({ page, tasks }) => {
    await tasks.open();

    // Create a task first
    await tasks.host.locator(".tasks__add-btn").click();
    await tasks.host.locator("#tasksScheduleInput").fill("30 12 * * 1");
    await tasks.host.locator("#tasksPromptInput").fill("Weekly report");
    await tasks.host.locator(".tasks__btn-save").click();

    // Verify task exists
    const taskList = tasks.host.locator(".tasks__list");
    await expect(taskList.locator(".tasks__item")).toHaveCount(1, {
      timeout: 5000,
    });

    // Set up the confirm dialog handler
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });

    // Click delete on the task
    await taskList.locator(".tasks__delete-btn").first().click();

    // Task should be removed
    await expect(taskList.locator(".tasks__item")).toHaveCount(0, {
      timeout: 5000,
    });

    // Should show empty state
    await expect(taskList.locator(".tasks__empty")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should cancel delete when dismissing confirm dialog", async ({
    page,
    tasks,
  }) => {
    await tasks.open();

    // Create a task
    await tasks.host.locator(".tasks__add-btn").click();
    await tasks.host.locator("#tasksScheduleInput").fill("0 0 * * *");
    await tasks.host.locator("#tasksPromptInput").fill("Midnight task");
    await tasks.host.locator(".tasks__btn-save").click();

    // Verify task exists
    const taskList = tasks.host.locator(".tasks__list");
    await expect(taskList.locator(".tasks__item")).toHaveCount(1, {
      timeout: 5000,
    });

    // Dismiss the confirm dialog
    page.once("dialog", async (dialog) => {
      await dialog.dismiss();
    });

    await taskList.locator(".tasks__delete-btn").first().click();

    // Task should still exist
    await expect(taskList.locator(".tasks__item")).toHaveCount(1);
  });

  test("should toggle task enabled/disabled", async ({ tasks }) => {
    await tasks.open();

    // Create a task
    await tasks.host.locator(".tasks__add-btn").click();
    await tasks.host.locator("#tasksScheduleInput").fill("*/5 * * * *");
    await tasks.host.locator("#tasksPromptInput").fill("Frequent task");
    await tasks.host.locator(".tasks__btn-save").click();

    const taskList = tasks.host.locator(".tasks__list");
    await expect(taskList.locator(".tasks__item")).toHaveCount(1, {
      timeout: 5000,
    });

    // Toggle should be checked (enabled) by default
    const toggle = taskList.locator(".tasks__toggle-input").first();
    await expect(toggle).toBeChecked();

    // Uncheck to disable
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    // Re-enable
    await toggle.click();
    await expect(toggle).toBeChecked();
  });

  test("should edit an existing task", async ({ tasks }) => {
    await tasks.open();

    // Create a task
    await tasks.host.locator(".tasks__add-btn").click();
    await tasks.host.locator("#tasksScheduleInput").fill("0 8 * * *");
    await tasks.host.locator("#tasksPromptInput").fill("Morning standup");
    await tasks.host.locator(".tasks__btn-save").click();

    const taskList = tasks.host.locator(".tasks__list");
    await expect(taskList.locator(".tasks__item")).toHaveCount(1, {
      timeout: 5000,
    });

    // Click edit
    await taskList.locator(".tasks__edit-btn").first().click();

    // Dialog should open in edit mode
    const dialog = tasks.host.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(tasks.host.locator(".tasks__dialog-title")).toContainText(
      "Edit",
    );

    // Modify the prompt
    await tasks.host.locator("#tasksPromptInput").fill("Updated standup notes");
    await tasks.host.locator(".tasks__btn-save").click();

    // Verify the updated text appears
    await expect(taskList).toContainText("Updated standup notes", {
      timeout: 5000,
    });
  });

  test("should close dialog on cancel", async ({ tasks }) => {
    await tasks.open();

    await tasks.host.locator(".tasks__add-btn").click();

    const dialog = tasks.host.locator("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await tasks.host.locator(".tasks__btn-cancel").click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
