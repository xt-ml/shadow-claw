import { Page } from "@playwright/test";
import { test, expect } from "./fixtures.js";

async function createOpfsTextFile(
  page: Page,
  fileName: string,
  content: string,
): Promise<void> {
  const { groupId, opfsRootName } = await page.evaluate(() => {
    const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
    return {
      groupId: bridge?.getActiveGroupId?.() || null,
      opfsRootName: bridge?.getOpfsRootName
        ? bridge.getOpfsRootName()
        : "shadowclaw",
    };
  });

  if (!groupId) {
    throw new Error("No active group ID available for test file upload");
  }

  const result = await page.evaluate(
    async ({ name, text, activeGroupId, rootName }) => {
      const root = await navigator.storage.getDirectory();
      const ws = await root.getDirectoryHandle(rootName, { create: true });
      const groups = await ws.getDirectoryHandle("groups", { create: true });
      const groupDir = await groups.getDirectoryHandle(
        activeGroupId.replace(/:/g, "-"),
        { create: true },
      );
      const fh = await groupDir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
      return true;
    },
    {
      name: fileName,
      text: content,
      activeGroupId: groupId,
      rootName: opfsRootName,
    },
  );

  expect(result).toBe(true);
  await page.waitForTimeout(400);
}

async function setMonacoSetting(
  page: Page,
  settings: any,
  enabled: boolean,
): Promise<void> {
  await settings.open();

  const envTab = settings.host.locator('[data-tab-target="environment"]');
  await envTab.click();

  const miscDetails = settings.host
    .locator('[data-tab-panel="environment"] details', { hasText: "Misc" })
    .first();
  if ((await miscDetails.getAttribute("open")) === null) {
    await miscDetails.locator("summary").first().click();
  }

  const toggle = settings.host.locator(
    '[data-setting="file-viewer-monaco-toggle"]',
  );
  await expect(toggle).toBeVisible({ timeout: 10000 });

  if ((await toggle.isChecked()) !== enabled) {
    await toggle.click();
    await page.waitForTimeout(800);
  }
}

async function openFileFromFilesPage(
  app: any,
  page: Page,
  fileName: string,
): Promise<void> {
  await app.navigateToWithOpenDialog("files");
  const files = app.filesComponent();
  const refreshBtn = files.locator(".files__refresh-btn");
  if ((page.viewportSize()?.width ?? 1280) <= 640) {
    await files.locator('summary[aria-label="Toggle page actions"]').click();
  }
  await expect(refreshBtn).toBeVisible({ timeout: 10000 });
  await refreshBtn.click();
  const item = files.locator(
    `.files__item-main[aria-label="Open file ${fileName}"]`,
  );
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.click();
  await expect(page.locator(".file-modal")).toHaveJSProperty("open", true);
}

test.describe("File Viewer Monaco Editor", () => {
  test("lazy-loads Monaco only when enabled in settings", async ({
    app,
    page,
    settings,
  }) => {
    const monacoRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/assets/monaco/")) {
        monacoRequests.push(req.url());
      }
    });

    await createOpfsTextFile(page, "lazy-check.mmd", "flowchart TD\n  A --> B");
    await openFileFromFilesPage(app, page, "lazy-check.mmd");
    await page.locator(".modal-edit-btn").click();
    await expect(page.locator(".file-editor")).toBeVisible();
    expect(monacoRequests).toEqual([]);

    await page.locator(".modal-close-btn").click();

    await setMonacoSetting(page, settings, true);
    await openFileFromFilesPage(app, page, "lazy-check.mmd");

    const frame = page.locator("iframe.file-monaco-frame");
    await expect(frame).toBeVisible({ timeout: 15000 });
    await expect(frame).toHaveAttribute("title", "Code editor: lazy-check.mmd");
    expect(monacoRequests.length).toBeGreaterThan(0);

    const monacoBody = page.frameLocator("iframe.file-monaco-frame");
    await expect(monacoBody.locator(".monaco-editor")).toBeVisible({
      timeout: 15000,
    });

    const status = page.locator(".file-editor-status");
    await expect(status).toHaveText(/Code editor ready/i, { timeout: 15000 });
  });

  test("supports editing, saving, and theme parity", async ({
    app,
    page,
    settings,
  }) => {
    await setMonacoSetting(page, settings, true);
    await createOpfsTextFile(page, "sample.json", '{\n  "ok": true\n}');
    await openFileFromFilesPage(app, page, "sample.json");

    const monacoFrame = page.frameLocator("iframe.file-monaco-frame");
    await expect(monacoFrame.locator(".monaco-editor")).toBeVisible({
      timeout: 15000,
    });

    await page.locator(".modal-edit-btn").click();
    await monacoFrame.locator(".view-lines").click();
    await page.keyboard.press("End");
    await page.keyboard.type("\n// edited");

    const saveBtn = page.locator(".modal-save-btn");
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await saveBtn.click();
    await expect(saveBtn).toBeHidden({ timeout: 10000 });

    // Theme parity: toggle dark-mode on <html>
    await page.evaluate(() => {
      document.documentElement.classList.remove("light-mode");
      document.documentElement.classList.add("dark-mode");
    });
    await page.waitForTimeout(200);
    const darkBg = await monacoFrame
      .locator(".monaco-editor")
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.evaluate(() => {
      document.documentElement.classList.remove("dark-mode");
      document.documentElement.classList.add("light-mode");
    });
    await page.waitForTimeout(200);
    const lightBg = await monacoFrame
      .locator(".monaco-editor")
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(darkBg).not.toBe(lightBg);
  });

  test("uses compact mobile layout without horizontal overflow", async ({
    app,
    page,
    settings,
  }) => {
    await setMonacoSetting(page, settings, true);
    await page.setViewportSize({ width: 360, height: 740 });
    await createOpfsTextFile(
      page,
      "mobile.md",
      "# Title\n\n```mermaid\ngraph TD\n  A-->B\n```",
    );
    await openFileFromFilesPage(app, page, "mobile.md");

    // Switch from auto-preview to raw/monaco view
    await page.locator(".modal-preview-btn").click();
    const monacoFrame = page.frameLocator("iframe.file-monaco-frame");
    await expect(monacoFrame.locator(".monaco-editor")).toBeVisible({
      timeout: 15000,
    });

    await expect(monacoFrame.locator(".minimap")).toBeHidden();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("falls back to basic textarea editor when Monaco assets fail to load", async ({
    app,
    page,
    settings,
  }) => {
    await setMonacoSetting(page, settings, true);
    await page.route("**/assets/monaco/**", (route) => route.abort());

    await createOpfsTextFile(page, "fallback.txt", "plain text");
    await openFileFromFilesPage(app, page, "fallback.txt");

    await expect(page.locator(".file-editor-status")).toContainText(
      /basic editor/i,
      { timeout: 20000 },
    );
  });
});
