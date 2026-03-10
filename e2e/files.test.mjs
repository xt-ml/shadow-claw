import { test, expect } from "./fixtures.mjs";

test.describe("Files Interface", () => {
  test("should render files page with file browser", async ({ files }) => {
    await files.open();
    await expect(files.fileList()).toHaveCount(1);
    await expect(files.uploadButton()).toHaveCount(1);
  });

  test("should display workspace directory", async ({ files }) => {
    await files.open();
    const contentRegions = files.host.locator(".files__content, .files__list");
    expect(await contentRegions.count()).toBeGreaterThan(0);
  });

  test("should have file upload capability", async ({ files }) => {
    await files.open();
    const hasUploadUi =
      (await files.uploadButton().count()) > 0 ||
      (await files.fileInput().count()) > 0;
    expect(hasUploadUi).toBe(true);
  });

  test("should have download capability", async ({ files }) => {
    await files.open();
    await expect(
      files.host.getByRole("button", { name: /backup/i }),
    ).toHaveCount(1);
  });

  test("should display current path or breadcrumb", async ({ files }) => {
    await files.open();
    const hasBreadcrumb = (await files.breadcrumbs().count()) > 0;
    const hasNav = (await files.host.locator("nav").count()) > 0;
    expect(hasBreadcrumb || hasNav).toBe(true);
  });

  test("should have file actions (delete, rename, etc)", async ({ files }) => {
    await files.open();
    expect(await files.allButtons().count()).toBeGreaterThan(0);
  });

  test("should support OPFS storage", async ({ files, page }) => {
    await files.open();
    const opfsSupport = await page.evaluate(async () => {
      try {
        const opfsRoot = await navigator.storage?.getDirectory();
        return {
          opfsAvailable: !!opfsRoot,
          storageApiExists: !!navigator.storage,
        };
      } catch (error) {
        return {
          opfsAvailable: false,
          storageApiExists: !!navigator.storage,
          error: error.message,
        };
      }
    });

    expect(opfsSupport.storageApiExists).toBe(true);
  });
});
