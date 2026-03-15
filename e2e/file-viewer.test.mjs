import { test, expect } from "./fixtures.mjs";

test.describe("File Viewer Modal", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure file APIs are available
    const hasFileApis = await page.evaluate(() => ({
      hasFile: typeof File === "function",
      hasBlob: typeof Blob === "function",
      hasFileList: typeof FileList !== "undefined",
    }));

    test.skip(
      !hasFileApis.hasFile || !hasFileApis.hasBlob,
      "File APIs are unavailable",
    );
  });

  test("should have file viewer modal in DOM and styled correctly", async ({
    app,
    page,
  }) => {
    await app.navigateTo("chat");

    // Modal should present in DOM but not visible
    const modal = page.locator(".file-modal");
    await expect(modal).toHaveCount(1);

    // Native dialog should be closed initially
    await expect(modal).toHaveJSProperty("open", false);

    // Check modal uses native dialog element
    await expect(modal).toHaveJSProperty("nodeName", "DIALOG");
    await expect(modal).toHaveAttribute("aria-label", /file viewer/i);

    // Check modal content structure exists
    const modalContent = page.locator(".modal-content");
    await expect(modalContent).toHaveCount(1);

    const modalHeader = page.locator(".modal-header");
    await expect(modalHeader).toHaveCount(1);

    const closeBtn = page.locator(".modal-close-btn");
    await expect(closeBtn).toHaveCount(1);

    const modalBody = page.locator(".modal-body");
    await expect(modalBody).toHaveCount(1);
  });

  test("should display modal on different pages", async ({ app, page }) => {
    // Check that modal is available and persistent across all pages
    const pages = ["chat", "files", "tasks"];

    for (const pageId of pages) {
      await app.navigateTo(pageId);

      const modal = page.locator(".file-modal");
      await expect(modal).toHaveCount(1);

      // Modal should exist but remain closed
      await expect(modal).toHaveJSProperty("open", false);
    }
  });
  test("should display file content in modal when clicking a file from files page", async ({
    app,
    page,
  }) => {
    await app.navigateTo("files");

    // Create a test file and upload it
    const testFileName = "test-document.md";
    const testContent = "# Test Document\n\nThis is a test file content.";

    await uploadTestFile(page, testFileName, testContent);

    // Wait for the file to appear in the list
    await page.waitForTimeout(500);

    // Click on the file to open the viewer
    const filesComponent = app.filesComponent();
    const fileItem = filesComponent.locator(".files__item-main").first();
    await fileItem.click();

    // Assert the file modal is visible
    const modal = page.locator(".file-modal");
    await expect(modal).toHaveJSProperty("open", true);

    // Verify modal content
    const modalTitle = page.locator(".modal-title");
    await expect(modalTitle).toContainText(testFileName);

    const modalContent = page.locator(".file-content");
    await expect(modalContent).toContainText(
      `Test Document\n\nThis is a test file content.\n`,
    );
  });

  test("should display file modal on files page and persist when navigating to chat", async ({
    app,
    page,
  }) => {
    await app.navigateTo("files");

    // Upload a test file
    const testFileName = "navigation-test.txt";
    const testContent = "This file tests navigation persistence.";

    await uploadTestFile(page, testFileName, testContent);

    // Wait for the file to appear
    await page.waitForTimeout(500);

    // Open the file viewer
    const filesComponent = app.filesComponent();
    const fileItem = filesComponent.locator(".files__item-main").first();
    await fileItem.click();

    // File modal should be visible
    const modal = page.locator(".file-modal");
    await expect(modal).toHaveJSProperty("open", true);

    // Navigate while the native dialog is open
    await app.navigateToWithOpenDialog("chat");

    // Modal should still be visible on the chat page
    await expect(modal).toHaveJSProperty("open", true);

    // Content should still be correct
    const modalTitle = page.locator(".modal-title");
    await expect(modalTitle).toContainText(testFileName);
  });

  test("should close file modal when close button is clicked", async ({
    app,
    page,
  }) => {
    await app.navigateTo("files");

    // Upload a test file
    const testFileName = "close-test.md";
    const testContent = "Test content for close button.";

    await uploadTestFile(page, testFileName, testContent);

    await page.waitForTimeout(500);

    // Open the file viewer
    const filesComponent = app.filesComponent();
    const fileItem = filesComponent.locator(".files__item-main").first();
    await fileItem.click();

    // Modal should be visible
    const modal = page.locator(".file-modal");
    await expect(modal).toHaveJSProperty("open", true);

    // Click the close button
    const closeBtn = page.locator(".modal-close-btn");
    await closeBtn.click();

    // Modal should be hidden
    await expect(modal).toHaveJSProperty("open", false);
  });

  test("should close file modal when escape key is pressed", async ({
    app,
    page,
  }) => {
    await app.navigateTo("files");

    const testFileName = "escape-close-test.md";
    const testContent = "Escape key should close this modal.";

    await uploadTestFile(page, testFileName, testContent);
    await page.waitForTimeout(500);

    const filesComponent = app.filesComponent();
    const fileItem = filesComponent.locator(".files__item-main").first();
    await fileItem.click();

    const modal = page.locator(".file-modal");
    await expect(modal).toHaveJSProperty("open", true);

    await page.keyboard.press("Escape");

    await expect(modal).toHaveJSProperty("open", false);
  });

  test("should display different file contents when clicking different files", async ({
    app,
    page,
  }) => {
    await app.navigateTo("files");

    // Upload two different test files
    const file1Name = "file-1.txt";
    const file1Content = "Content of first file";

    const file2Name = "file-2.txt";
    const file2Content = "Content of second file";

    await uploadTestFile(page, file1Name, file1Content);
    await uploadTestFile(page, file2Name, file2Content);

    await page.waitForTimeout(500);

    const filesComponent = app.filesComponent();

    // Open first file
    const fileItems = filesComponent.locator(".files__item-main");
    await fileItems.first().click();

    const modalTitle = page.locator(".modal-title");
    const modalContent = page.locator(".file-content");

    await expect(modalTitle).toContainText(file1Name);
    await expect(modalContent).toContainText(file1Content);

    // Close modal
    await page.locator(".modal-close-btn").click();

    await page.waitForTimeout(300);

    // Open second file
    const allFileItems = filesComponent.locator(".files__item-main");
    await allFileItems.nth(1).click();

    // Should show second file content
    await expect(modalTitle).toContainText(file2Name);
    await expect(modalContent).toContainText(file2Content);
  });

  test("should display file modal on tasks page when opening a file", async ({
    app,
    page,
  }) => {
    // First upload a file from files page
    await app.navigateTo("files");

    const testFileName = "tasks-page-test.txt";
    const testContent = "Testing modal visibility on tasks page.";

    await uploadTestFile(page, testFileName, testContent);

    await page.waitForTimeout(500);

    // Open the file
    const filesComponent = app.filesComponent();
    const fileItem = filesComponent.locator(".files__item-main").first();
    await fileItem.click();

    // Modal should be visible on files page
    const modal = page.locator(".file-modal");
    await expect(modal).toHaveJSProperty("open", true);

    // Navigate while the native dialog is open
    await app.navigateToWithOpenDialog("tasks");

    // Modal should still be visible on tasks page
    await expect(modal).toHaveJSProperty("open", true);

    // Content should be correct
    const modalTitle = page.locator(".modal-title");
    const modalContent = page.locator(".file-content");
    await expect(modalTitle).toContainText(testFileName);
    await expect(modalContent).toContainText(testContent);
  });

  test("should display file modal with proper accessibility attributes", async ({
    app,
    page,
  }) => {
    await app.navigateTo("files");

    const testFileName = "a11y-test.txt";
    const testContent = "Testing accessibility attributes.";

    await uploadTestFile(page, testFileName, testContent);

    await page.waitForTimeout(500);

    const filesComponent = app.filesComponent();
    const fileItem = filesComponent.locator(".files__item-main").first();
    await fileItem.click();

    // Check modal has proper attributes
    const modal = page.locator(".file-modal");
    await expect(modal).toHaveJSProperty("nodeName", "DIALOG");
    await expect(modal).toHaveJSProperty("open", true);
    await expect(modal).toHaveAttribute("aria-label", /file viewer/i);

    // Check close button has proper label
    const closeBtn = page.locator(".modal-close-btn");
    await expect(closeBtn).toHaveAttribute("aria-label", /close file viewer/i);
  });
});

/**
 * Helper function to upload a test file
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} fileName - The name of the file to upload
 * @param {string} content - The content of the file
 */
async function uploadTestFile(page, fileName, content) {
  // First, ensure the orchestrator store is ready
  await page.evaluate(async () => {
    let attempts = 0;
    while (attempts < 100) {
      if (
        window.orchestratorStore?.activeGroupId &&
        window.orchestratorStore?.loadFiles
      ) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      attempts++;
    }

    throw new Error("Orchestrator store not ready after 10 seconds");
  });

  // Wait a bit more for full initialization
  await page.waitForTimeout(1000);

  // Create the file in OPFS
  const created = await page.evaluate(
    async ({ fileName: name, content: text }) => {
      const groupId = window.orchestratorStore.activeGroupId;
      console.log("[E2E] Creating file in OPFS:", { name, groupId });

      if (!groupId) {
        throw new Error("No active group ID");
      }

      try {
        const root = await navigator.storage.getDirectory();
        const workspaceDir = await root.getDirectoryHandle("shadowclaw", {
          create: true,
        });

        // Sanitize groupId for filesystem: replace colons with dashes
        const safeId = groupId.replace(/:/g, "-");
        const groupsDir = await workspaceDir.getDirectoryHandle("groups", {
          create: true,
        });

        const safeGroupDir = await groupsDir.getDirectoryHandle(safeId, {
          create: true,
        });

        // Create the file
        const fileHandle = await safeGroupDir.getFileHandle(name, {
          create: true,
        });

        const writable = await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();

        console.log("[E2E] File created successfully:", name);
        return { success: true, fileName: name };
      } catch (error) {
        console.error("Failed to create test file in OPFS:", error);

        throw error;
      }
    },
    { fileName, content },
  );

  if (!created.success) {
    throw new Error(`Failed to create test file: ${created.error}`);
  }

  // Wait for the file to be created
  await page.waitForTimeout(500);

  // Reload the files by calling loadFiles
  const reloaded = await page.evaluate(async () => {
    try {
      console.log(
        "[E2E] Before loadFiles - files in store:",
        window.orchestratorStore?.files?.length || 0,
      );

      if (window.orchestratorStore?.loadFiles) {
        await window.orchestratorStore.loadFiles(window.__SHADOWCLAW_DB__);
        console.log(
          "[E2E] After loadFiles - files in store:",
          window.orchestratorStore?.files || [],
        );

        return {
          success: true,
          fileCount: window.orchestratorStore?.files?.length || 0,
        };
      }

      return { success: false, reason: "loadFiles not available" };
    } catch (error) {
      console.error("[E2E] loadFiles error:", error);
      return { success: false, reason: error.message };
    }
  });

  console.log("[E2E] loadFiles result:", reloaded);

  // Wait for the files to appear in the store
  await page.waitForFunction(
    ({ fileName }) => {
      const files = window.orchestratorStore?.files || [];

      const fileExists = files.some((f) => f === fileName);
      return fileExists;
    },
    { fileName, timeout: 10000 },
  );

  // Wait for the UI to update and render
  await page.waitForTimeout(1500);
}
