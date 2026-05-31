import { effect } from "../../effect.js";
import { renderMarkdown } from "../../markdown.js";
import {
  sanitizeSrcdocHtml,
  setSanitizedHtml,
  setTrustedSrcdoc,
} from "../../security/trusted-types.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { readGroupFile } from "../../storage/readGroupFile.js";
import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";
import { showError, showSuccess } from "../../toast.js";
import type { Config } from "dompurify";
import type {
  GroupMeta,
  SavedPageRef,
  ShadowClawDatabase,
} from "../../types.js";

import { getDb } from "../../db/db.js";
import { handleSpecialLinkNavigation } from "../../utils.js";
import ShadowClawElement from "../shadow-claw-element.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

const previewSanitizeOptions: Config = {
  // Allow blob URLs for locally resolved OPFS preview assets.
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

const elementName = "shadow-claw-pages";

export class ShadowClawPages extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawPages.componentPath}/${elementName}.css`;
  static template = `${ShadowClawPages.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  get selectedPage(): SavedPageRef | null {
    return orchestratorStore.activePinnedPage;
  }

  set selectedPage(val: SavedPageRef | null) {
    if (this.pageRefKey(val) === this.pageRefKey(this.selectedPage)) {
      return;
    }

    if (this.db) {
      void orchestratorStore.setActivePinnedPage(this.db, val);
    } else {
      orchestratorStore._activePinnedPage.set(val);
    }

    this.renderPageList(orchestratorStore.pages, orchestratorStore.groups);
    void this.renderSelectedPage();
  }

  renderToken: number = 0;
  previewFrameWindow: Window | null = null;

  async buildHtmlPageSrcdoc(
    content: string,
    filePath: string,
  ): Promise<string> {
    const resolvedHtml = this.db
      ? await this.resolveRelativeImagesInHtml(content, filePath)
      : content;

    const safeContent = sanitizeSrcdocHtml(
      resolvedHtml,
      previewSanitizeOptions,
    );

    // Nonce-gated CSP: only the bridge script (served same-origin) may run.
    // Inline scripts and other external scripts are blocked.
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const bridgeScriptUrl = "/assets/file-viewer-preview-bridge.js";

    return [
      "<!doctype html>",
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
      `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'">`,
      '<base target="_blank">',
      `<script src="${bridgeScriptUrl}" nonce="${nonce}"><\/script>`,
      "<style>",
      "  img { max-width: 100%; max-height: 100%; }",
      "</style>",
      "</head><body>",
      safeContent,
      "</body></html>",
    ].join("");
  }

  /**
   * Resolves relative image src attributes in HTML by loading files from OPFS
   * and replacing the src with a blob URL.
   */
  async resolveRelativeImagesInHtml(
    html: string,
    filePath: string,
  ): Promise<string> {
    if (!this.db || !html) {
      return html;
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    const images = Array.from(parsed.querySelectorAll("img"));
    if (images.length === 0) {
      return html;
    }

    const groupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;

    await Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute("src") || "";
        if (
          !src ||
          /^(?:[a-zA-Z][a-zA-Z\d+.-]*:|blob:|data:|#|\/\/)/u.test(src)
        ) {
          return;
        }

        const resolved = this.resolveWorkspaceLinkPath(src, filePath);
        if (!resolved) {
          return;
        }

        try {
          const bytes = await readGroupFileBytes(this.db!, groupId, resolved);
          const ext = resolved.split(".").pop()?.toLowerCase() || "";
          const mimeTypeMap: Record<string, string> = {
            apng: "image/apng",
            avif: "image/avif",
            gif: "image/gif",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            svg: "image/svg+xml",
            webp: "image/webp",
          };
          const mimeType = mimeTypeMap[ext] ?? "image/jpeg";
          const blobBytes = new Uint8Array(bytes.byteLength);
          blobBytes.set(bytes);

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(new Blob([blobBytes], { type: mimeType }));
          });

          img.setAttribute("src", dataUrl);
        } catch {
          // File not found or unreadable — leave src as-is.
        }
      }),
    );

    return parsed.body.innerHTML;
  }

  handleIframeMessage = (event: MessageEvent) => {
    if (!this.db || !event.data || typeof event.data !== "object") {
      return;
    }

    const payload = event.data as { type?: unknown; href?: unknown };
    if (
      payload.type !== "shadow-claw-file-viewer-link" ||
      typeof payload.href !== "string"
    ) {
      return;
    }

    if (this.previewFrameWindow && event.source !== this.previewFrameWindow) {
      return;
    }

    const basePath = this.selectedPage?.path || "";
    const currentGroupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;

    const href = payload.href;
    const handled = handleSpecialLinkNavigation(href, basePath, currentGroupId);
    if (!handled) {
      // Try to resolve as a workspace-relative path within pages
      const resolvedPath = this.resolveWorkspaceLinkPath(href, basePath);
      if (resolvedPath) {
        void this.openWorkspaceLink(resolvedPath);
      }
    }
  };

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

    window.addEventListener("message", this.handleIframeMessage);

    const rendered = root.querySelector("[data-pages-rendered]");
    rendered?.addEventListener("click", (event: Event) => {
      if (event instanceof MouseEvent) {
        void this.handleRenderedLinkClick(event);
      }
    });

    root.addEventListener("click", (event: Event) => {
      const dropdown = root.querySelector("[data-pages-dropdown]");
      if (dropdown instanceof HTMLDetailsElement && dropdown.open) {
        const target = event.target as HTMLElement;
        if (!dropdown.contains(target)) {
          dropdown.removeAttribute("open");
        }
      }
    });

    this.setupEffects();
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.handleIframeMessage);
    this.previewFrameWindow = null;
    super.disconnectedCallback?.();
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
    const currentGroupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;

    const handled = handleSpecialLinkNavigation(href, basePath, currentGroupId);
    if (handled) {
      event.preventDefault();
    }
  }

  handleAnchorNavigation(anchor: string): boolean {
    const root = this.shadowRoot;
    if (!root) {
      return false;
    }

    const rendered = root.querySelector("[data-pages-rendered]") as HTMLElement;
    if (!rendered || rendered.hidden) {
      return false;
    }

    const id = anchor.replace(/^#/, "");
    const target =
      rendered.querySelector(`[id="${id}"]`) ||
      rendered.querySelector(`a[name="${id}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      return true;
    }

    return false;
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

  private pageRefKey(page: SavedPageRef | null): string {
    if (!page) {
      return "";
    }

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
        const activePinnedPage = orchestratorStore.activePinnedPage;
        this.renderPageList(pages, groups);

        if (pages.length === 0) {
          if (activePinnedPage !== null) {
            this.selectedPage = null;
          }
        } else if (
          !activePinnedPage ||
          !pages.some(
            (page) =>
              this.pageRefKey(page) === this.pageRefKey(activePinnedPage),
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
    iframe.setAttribute(
      "sandbox",
      "allow-modals allow-scripts allow-popups allow-popups-to-escape-sandbox",
    );
    iframe.hidden = true;
    iframe.addEventListener("load", () => {
      this.previewFrameWindow = iframe.contentWindow;
    });
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

    const dropdownSelected = root.querySelector(
      "[data-pages-dropdown-selected]",
    );
    if (dropdownSelected instanceof HTMLElement) {
      if (this.selectedPage) {
        dropdownSelected.textContent = this.selectedPage.path;
      } else {
        dropdownSelected.textContent = "Select a page...";
      }
    }

    const lists = root.querySelectorAll("[data-pages-list]");
    if (lists.length === 0) {
      return;
    }

    lists.forEach((list) => {
      if (list instanceof HTMLElement) {
        list.replaceChildren();
      }
    });

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

    lists.forEach((list) => {
      if (!(list instanceof HTMLElement)) {
        return;
      }

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

            const details = list.closest("details");
            if (details) {
              details.removeAttribute("open");
            }
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
    });
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
        this.previewFrameWindow = null;
        setTrustedSrcdoc(
          iframe,
          await this.buildHtmlPageSrcdoc(content, selectedPage.path),
        );

        return;
      }

      this.removePreviewIframe(root);
      rendered.hidden = false;

      if (this.isMarkdownPath(selectedPage.path)) {
        const html = await renderMarkdown(content);
        if (token !== this.renderToken) {
          return;
        }

        const resolvedHtml = await this.resolveRelativeImagesInHtml(
          html,
          selectedPage.path,
        );
        if (token !== this.renderToken) {
          return;
        }

        setSanitizedHtml(rendered, resolvedHtml, previewSanitizeOptions);

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
