import { effect } from "../../effect.js";
import { renderMarkdown } from "../../markdown.js";
import {
  sanitizeSrcdocHtml,
  setSanitizedHtml,
  setTrustedSrcdoc,
} from "../../security/trusted-types.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { readGroupFile } from "../../storage/readGroupFile.js";
import { showError, showSuccess } from "../../toast.js";
import type {
  GroupMeta,
  SavedPageRef,
  ShadowClawDatabase,
} from "../../types.js";

import { getDb } from "../../db/db.js";
import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-pages";

export class ShadowClawPages extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawPages.componentPath}/${elementName}.css`;
  static template = `${ShadowClawPages.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  selectedPage: SavedPageRef | null = null;
  renderToken: number = 0;

  buildHtmlPageSrcdoc(content: string): string {
    const safeContent = sanitizeSrcdocHtml(content);

    return [
      "<!doctype html>",
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'">',
      '<base target="_blank">',
      "</head><body>",
      safeContent,
      "</body></html>",
    ].join("");
  }

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();

    await orchestratorStore.whenInitialized;

    const rendered = root.querySelector("[data-pages-rendered]");
    rendered?.addEventListener("click", (event: Event) => {
      if (event instanceof MouseEvent) {
        void this.handleRenderedLinkClick(event);
      }
    });

    this.setupEffects();
  }

  async handleRenderedLinkClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const href = link.getAttribute("href") || "";
    const basePath = this.selectedPage?.path || "";
    const resolved = this.resolveWorkspaceLinkPath(href, basePath);

    if (!resolved) {
      return;
    }

    event.preventDefault();
    await this.openWorkspaceLink(resolved);
  }

  async openWorkspaceLink(path: string) {
    if (!this.selectedPage) {
      return;
    }

    this.selectedPage = {
      groupId: this.selectedPage.groupId,
      path,
    };
    this.renderPageList(orchestratorStore.pages, orchestratorStore.groups);
    await this.renderSelectedPage();
  }

  private pageRefKey(page: SavedPageRef): string {
    return `${page.groupId}\u0000${page.path}`;
  }

  resolveWorkspaceLinkPath(href: string, basePath: string = ""): string | null {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return null;
    }

    let candidate = trimmed;
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);

    if (hasScheme || trimmed.startsWith("//")) {
      let parsed: URL;
      try {
        parsed = new URL(trimmed, window.location.href);
      } catch {
        return null;
      }

      const isHttp =
        parsed.protocol === "http:" || parsed.protocol === "https:";
      if (!isHttp || parsed.host !== window.location.host) {
        return null;
      }

      candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    let normalized = candidate.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    const isAbsolute = normalized.startsWith("/");
    normalized = normalized.replace(/^\/+/, "");

    if (!normalized) {
      return null;
    }

    const stack: string[] = [];

    if (!isAbsolute) {
      const baseNormalized = basePath.replace(/\\/g, "/").replace(/^\/+/, "");
      const baseParts = baseNormalized.split("/").filter(Boolean);
      baseParts.pop();
      stack.push(...baseParts);
    }

    for (const part of normalized.split("/")) {
      if (!part || part === ".") {
        continue;
      }

      if (part === "..") {
        if (stack.length === 0) {
          return null;
        }

        stack.pop();

        continue;
      }

      stack.push(part);
    }

    return stack.length > 0 ? stack.join("/") : null;
  }

  setupEffects() {
    this.addCleanup(
      effect(() => {
        const pages = orchestratorStore.pages;
        const groups = orchestratorStore.groups;
        const activeGroupId = orchestratorStore.activeGroupId;
        this.renderPageList(pages, groups);

        if (pages.length === 0) {
          this.selectedPage = null;
        } else if (
          !this.selectedPage ||
          !pages.some(
            (page) =>
              this.pageRefKey(page) === this.pageRefKey(this.selectedPage!),
          )
        ) {
          const activeGroupPage = pages.find(
            (page) => page.groupId === activeGroupId,
          );
          this.selectedPage = activeGroupPage || pages[0];
        }

        void this.renderSelectedPage();
      }),
    );
  }

  isMarkdownPath(path: string): boolean {
    return /\.(md|markdown)$/iu.test(path);
  }

  isHtmlPath(path: string): boolean {
    return /\.(html?|xhtml)$/iu.test(path);
  }

  private ensurePreviewIframe(
    root: ShadowRoot,
    rendered: HTMLElement,
  ): HTMLIFrameElement {
    const existing = root.querySelector("[data-pages-iframe]");
    if (existing instanceof HTMLIFrameElement) {
      return existing;
    }

    const iframe = document.createElement("iframe");
    iframe.className = "pages__iframe";
    iframe.setAttribute("data-pages-iframe", "");
    iframe.setAttribute("sandbox", "allow-same-origin");
    iframe.hidden = true;
    rendered.before(iframe);

    return iframe;
  }

  private removePreviewIframe(root: ShadowRoot): void {
    const iframe = root.querySelector("[data-pages-iframe]");
    if (!(iframe instanceof HTMLIFrameElement)) {
      return;
    }

    iframe.removeAttribute("srcdoc");
    iframe.remove();
  }

  renderPageList(pages: SavedPageRef[], groups: GroupMeta[]) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const status = root.querySelector("[data-pages-status]");
    if (status instanceof HTMLElement) {
      status.textContent =
        pages.length === 1 ? "1 saved page" : `${pages.length} saved pages`;
    }

    const list = root.querySelector("[data-pages-list]");
    if (!(list instanceof HTMLElement)) {
      return;
    }

    list.replaceChildren();

    if (pages.length === 0) {
      return;
    }

    const groupNameById = new Map(
      groups.map((group) => [group.groupId, group.name]),
    );
    const pagesByGroup = new Map<string, SavedPageRef[]>();

    pages.forEach((page) => {
      const groupPages = pagesByGroup.get(page.groupId) || [];
      groupPages.push(page);
      pagesByGroup.set(page.groupId, groupPages);
    });

    for (const [groupId, groupPages] of pagesByGroup) {
      const groupLabel = document.createElement("div");
      groupLabel.className = "pages__group-label";
      groupLabel.textContent = groupNameById.get(groupId) || groupId;
      list.appendChild(groupLabel);

      groupPages.forEach((page) => {
        const path = page.path;
        const row = document.createElement("div");
        row.className = "pages__list-item";
        if (
          this.selectedPage &&
          this.pageRefKey(page) === this.pageRefKey(this.selectedPage)
        ) {
          row.classList.add("active");
        }

        const selectBtn = document.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = "pages__select";
        selectBtn.title = `Open ${path}`;

        const pathSpan = document.createElement("span");
        pathSpan.className = "pages__list-path";
        pathSpan.textContent = path;
        selectBtn.appendChild(pathSpan);

        const removeBtn = document.createElement("button");
        removeBtn.className = "pages__remove";
        removeBtn.type = "button";
        removeBtn.title = "Remove from Pages";
        removeBtn.setAttribute(
          "aria-label",
          `Remove ${path} from Pages in ${(groupNameById.get(groupId) || groupId) as string}`,
        );
        removeBtn.textContent = "✕";

        selectBtn.addEventListener("click", () => {
          this.selectedPage = page;
          this.renderPageList(
            orchestratorStore.pages,
            orchestratorStore.groups,
          );
          void this.renderSelectedPage();
        });

        removeBtn.addEventListener("click", async (event) => {
          event.stopPropagation();

          if (!this.db) {
            return;
          }

          try {
            await orchestratorStore.removePage(this.db, path, groupId);
            showSuccess(`Removed ${path} from Pages`, 2400);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            showError(`Failed to remove page: ${message}`, 4500);
          }
        });

        row.appendChild(selectBtn);
        row.appendChild(removeBtn);
        list.appendChild(row);
      });
    }
  }

  async renderSelectedPage() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const empty = root.querySelector("[data-pages-empty]");
    const rendered = root.querySelector("[data-pages-rendered]");

    if (!(empty instanceof HTMLElement) || !(rendered instanceof HTMLElement)) {
      return;
    }

    const selectedPage = this.selectedPage;
    if (!this.db || !selectedPage) {
      empty.hidden = false;
      rendered.hidden = true;
      rendered.textContent = "";
      this.removePreviewIframe(root);

      return;
    }

    const token = ++this.renderToken;

    try {
      const content = await readGroupFile(
        this.db,
        selectedPage.groupId,
        selectedPage.path,
      );
      if (token !== this.renderToken) {
        return;
      }

      empty.hidden = true;

      if (this.isHtmlPath(selectedPage.path)) {
        rendered.hidden = true;
        const iframe = this.ensurePreviewIframe(root, rendered);
        iframe.hidden = false;
        setTrustedSrcdoc(iframe, this.buildHtmlPageSrcdoc(content));

        return;
      }

      this.removePreviewIframe(root);
      rendered.hidden = false;

      if (this.isMarkdownPath(selectedPage.path)) {
        const html = await renderMarkdown(content);
        if (token !== this.renderToken) {
          return;
        }

        setSanitizedHtml(rendered, html);

        return;
      }

      rendered.textContent = content;
    } catch (error) {
      empty.hidden = false;
      rendered.hidden = true;
      rendered.textContent = "";
      this.removePreviewIframe(root);
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to load page ${selectedPage.path}: ${message}`, 5000);
    }
  }
}

customElements.define(elementName, ShadowClawPages);
