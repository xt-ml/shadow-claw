import { expect, Locator, Page } from "@playwright/test";
import { FileBrowserComponent } from "../components/file-browser.component.js";
import { AppPage } from "./app.page.js";

export class FilesPage {
  app: AppPage;
  browser: FileBrowserComponent;
  host: Locator;
  page: Page;

  constructor(app: AppPage) {
    this.app = app;
    this.page = app.page;
    this.host = app.filesComponent();
    this.browser = new FileBrowserComponent(this.host);
  }

  allButtons() {
    return this.host.locator("button");
  }

  breadcrumbs() {
    return this.browser.breadcrumbs();
  }

  fileInput() {
    return this.browser.fileInput();
  }

  fileList() {
    return this.browser.fileList();
  }

  uploadButton() {
    return this.browser.uploadButton();
  }

  async open() {
    await this.app.navigateTo("files");
    await expect(this.host).toHaveCount(1);
  }
}
