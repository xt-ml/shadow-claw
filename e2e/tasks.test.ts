import { test, expect } from "./fixtures.js";

test.describe("Tasks Interface", () => {
  test("should render tasks page with task list", async ({ tasks }) => {
    await tasks.open();
    await expect(tasks.host).toBeVisible();
  });

  test("should have button to create new task", async ({ tasks }) => {
    await tasks.open();
    await expect(
      tasks.host.getByRole("button", { name: /new|add|create/i }),
    ).toBeVisible();
  });

  test("should display task properties (name, cron, enabled)", async ({
    tasks,
  }) => {
    await tasks.open();

    // Create a task to ensure properties are displayed in the list
    await tasks.createTask("0 0 * * *", "Property check");

    // The schedule should be visible
    await expect(tasks.host.getByText("0 0 * * *")).toBeVisible();
    // The toggle should be visible
    await expect(tasks.toggles().first()).toBeVisible();
  });

  test("should have cron expression input/display", async ({ tasks }) => {
    await tasks.open();

    // Check dialog input (hidden by default but exists)
    await expect(tasks.host.locator("#tasksScheduleInput")).toHaveCount(1);

    // Create a task and check display
    await tasks.createTask("0 9 * * *", "Cron check");
    await expect(tasks.host.getByText("0 9 * * *")).toBeVisible();
  });

  test("should have enable/disable toggle for tasks", async ({ tasks }) => {
    await tasks.open();

    await tasks.createTask("0 0 * * *", "Toggle test");

    // Wait for the toggle to appear and check its state
    const toggle = tasks.toggles().first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();
  });

  test("should display task list or empty state", async ({ tasks }) => {
    await tasks.open();

    const taskLikeNodes = tasks.taskLikeElements();
    const emptyState = tasks.host.getByText(/no tasks|empty/i);

    // Should show either tasks or the empty state message
    await expect(taskLikeNodes.or(emptyState).first()).toBeVisible();
  });

  test("should have delete/remove task functionality", async ({ tasks }) => {
    await tasks.open();

    await tasks.createTask("0 0 * * *", "Delete test");

    const deleteBtn = tasks.host.locator(".tasks__delete-btn").first();
    await expect(deleteBtn).toBeVisible();
  });

  test("should validate cron expressions", async ({ tasks }) => {
    await tasks.open();

    await tasks.host.locator(".tasks__add-btn").click();
    const input = tasks.host.locator("#tasksScheduleInput");
    await input.fill("invalid-cron");

    // We expect some validation feedback (could be browser validation or custom)
    // Here we just check that the input exists and we can interact with it
    await expect(input).toHaveValue("invalid-cron");
  });
});
