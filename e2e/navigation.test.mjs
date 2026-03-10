import { test, expect } from "./fixtures.mjs";

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
    expect(defaultPage).toBe("chat");

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
});
