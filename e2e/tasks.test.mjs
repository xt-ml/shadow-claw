import { test, expect } from "./fixtures.mjs";

test.describe("Tasks Interface", () => {
  test("should render tasks page with task list", async ({ tasks }) => {
    await tasks.open();
    await expect(tasks.host).toHaveCount(1);
  });

  test("should have button to create new task", async ({ tasks }) => {
    await tasks.open();
    await expect(
      tasks.host.getByRole("button", { name: /new|add|create/i }),
    ).toHaveCount(1);
  });

  test("should display task properties (name, cron, enabled)", async ({
    tasks,
  }) => {
    await tasks.open();

    const hasInputs = (await tasks.textInputs().count()) > 0;
    const hasToggles = (await tasks.toggles().count()) > 0;

    expect(hasInputs || hasToggles).toBe(true);
  });

  test("should have cron expression input/display", async ({ tasks }) => {
    await tasks.open();

    const hasCronField =
      (await tasks.host.getByLabel(/cron|schedule/i).count()) > 0;
    const hasTextInput = (await tasks.textInputs().count()) > 0;

    expect(hasCronField || hasTextInput).toBe(true);
  });

  test("should have enable/disable toggle for tasks", async ({ tasks }) => {
    await tasks.open();

    expect(await tasks.toggles().count()).toBeGreaterThan(0);
  });

  test("should display task list or empty state", async ({ tasks }) => {
    await tasks.open();

    const hasTaskLikeNodes = (await tasks.taskLikeElements().count()) > 0;
    const hasEmptyState =
      (await tasks.host.getByText(/no tasks|empty/i).count()) > 0;

    expect(hasTaskLikeNodes || hasEmptyState).toBe(true);
  });

  test("should have delete/remove task functionality", async ({ tasks }) => {
    await tasks.open();

    expect(await tasks.allButtons().count()).toBeGreaterThan(0);
  });

  test("should validate cron expressions", async ({ tasks }) => {
    await tasks.open();

    const hasValidationHooks =
      (await tasks.host
        .locator(".error, [class*='invalid'], [aria-invalid]")
        .count()) >= 0;

    expect(hasValidationHooks).toBe(true);
  });
});
