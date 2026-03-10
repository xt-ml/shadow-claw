import { expect } from "@playwright/test";

/**
 * File browser component - handles file list, breadcrumbs, and upload controls.
 */
export class FileBrowserComponent {
  /**
   * @param {import('@playwright/test').Locator} filesHost - The shadow-claw-files locator
   */
  constructor(filesHost) {
    this.host = filesHost;
  }

  fileList() {
    return this.host.locator(".files__list");
  }

  breadcrumbs() {
    return this.host.locator(".files__breadcrumbs");
  }

  uploadButton() {
    return this.host.locator(".files__upload-btn");
  }

  backupButton() {
    return this.host.getByRole("button", { name: /backup/i });
  }

  fileInput() {
    return this.host.locator('input[type="file"]');
  }

  fileItem(name) {
    return this.host.locator(`[data-file-name="${name}"]`);
  }

  async expectCoreUi() {
    await expect(this.fileList()).toHaveCount(1);
    const hasUpload =
      (await this.uploadButton().count()) > 0 ||
      (await this.fileInput().count()) > 0;
    expect(hasUpload).toBe(true);
  }

  async navigateToBreadcrumb(index) {
    await this.breadcrumbs().locator("a, button").nth(index).click();
  }
}
