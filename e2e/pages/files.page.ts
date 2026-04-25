import { expect, Locator, Page } from "@playwright/test";
import { FileBrowserComponent } from "../components/file-browser.component.js";
import { AppPage } from "./app.page.js";

export class FilesPage {
  app: AppPage;
  page: Page;
  host: Locator;
  browser: FileBrowserComponent;

  constructor(app: AppPage) {
    this.app = app;
    this.page = app.page;
    this.host = app.filesComponent();
    this.browser = new FileBrowserComponent(this.host);
  }

  async open() {
    await this.app.navigateTo("files");
    await expect(this.host).toHaveCount(1);
  }

  fileList() {
    return this.browser.fileList();
  }

  uploadButton() {
    return this.browser.uploadButton();
  }

  fileInput() {
    return this.browser.fileInput();
  }

  breadcrumbs() {
    return this.browser.breadcrumbs();
  }

  allButtons() {
    return this.host.locator("button");
  }
}
