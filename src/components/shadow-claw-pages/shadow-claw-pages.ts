import { effect } from "../../effect.js";
import {
  getFileRouteDirPath,
  getWorkspaceRouteRequestPath,
  resolveHrefAgainstRoute,
  applyBasePath,
} from "../../app-routes.js";
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
    const resolvedHtml = this.rewriteWorkspacePreviewHtml(content, filePath);
    const groupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;
    const inlinedHtml = await this.resolveRelativeImagesInHtml(
      resolvedHtml,
      filePath,
      groupId,
    );

    const safeContent = sanitizeSrcdocHtml(inlinedHtml, previewSanitizeOptions);

    // Nonce-gated CSP: only the bridge script (served same-origin) may run.
    // Inline scripts and other external scripts are blocked.
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const bridgeScriptUrl = "/assets/file-viewer-preview-bridge.js";

    return [
      "<!doctype html>",
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
      `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'">`,
      `<base href="${this.getPageRouteDirectory(filePath)}" target="_blank">`,
      `<script src="${bridgeScriptUrl}" nonce="${nonce}"><\/script>`,
      "<style>",
      "  img { max-width: 100%; max-height: 100%; }",
      "</style>",
      "</head><body>",
      safeContent,
      "</body></html>",
    ].join("");
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
    const routeDir = this.getPageRouteDirectory(basePath);
    const resolved = resolveHrefAgainstRoute(
      payload.href,
      routeDir,
      window.location.origin,
    );
    if (!resolved) {
      return;
    }

    if (resolved.origin !== window.location.origin) {
      window.open(resolved.href, "_blank", "noopener,noreferrer");

      return;
    }

    const targetPath = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    const nav = (window as any).navigation;
    if (nav && typeof nav.navigate === "function") {
      nav.navigate(targetPath);

      return;
    }

    window.history.pushState({}, "", targetPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
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

  private pageRefKey(page: SavedPageRef | null): string {
    if (!page) {
      return "";
    }

    return `${page.groupId}\u0000${page.path}`;
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

        const resolvedHtml = this.rewriteWorkspacePreviewHtml(
          html,
          selectedPage.path,
        );
        if (token !== this.renderToken) {
          return;
        }

        setSanitizedHtml(rendered, resolvedHtml, previewSanitizeOptions);
        await this.resolveMarkdownImages(
          rendered,
          selectedPage.groupId,
          selectedPage.path,
        );

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

  getPageRouteDirectory(filePath: string): string {
    const groupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;

    return applyBasePath(getFileRouteDirPath(groupId, filePath));
  }

  rewriteWorkspacePreviewHtml(html: string, filePath: string): string {
    if (!html) {
      return html;
    }

    const routeDir = this.getPageRouteDirectory(filePath);
    const parsed = new DOMParser().parseFromString(html, "text/html");

    const rewrite = (selector: string, attribute: "href" | "src") => {
      const nodes = Array.from(parsed.querySelectorAll(selector));
      for (const node of nodes) {
        const currentValue = node.getAttribute(attribute) || "";
        const trimmed = currentValue.trim();
        if (
          !trimmed ||
          trimmed.startsWith("#") ||
          trimmed.startsWith("javascript:")
        ) {
          continue;
        }

        const resolved = resolveHrefAgainstRoute(
          trimmed,
          routeDir,
          window.location.origin,
        );
        if (!resolved || resolved.origin !== window.location.origin) {
          continue;
        }

        node.setAttribute(
          attribute,
          `${resolved.pathname}${resolved.search}${resolved.hash}`,
        );
      }
    };

    rewrite("a[href]", "href");
    rewrite("img[src]", "src");
    rewrite("audio[src]", "src");
    rewrite("video[src]", "src");
    rewrite("source[src]", "src");

    return parsed.body.innerHTML;
  }

  resolveWorkspaceLinkPath(
    href: string,
    filePath: string,
    groupId: string,
  ): string | null {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return null;
    }

    const rawPath = trimmed.split(/[?#]/, 1)[0];
    const normalizedRoutePath = rawPath.replace(/^(?:\.\/)+/u, "");
    const routeCandidates: string[] = [];

    if (normalizedRoutePath.startsWith("files/")) {
      routeCandidates.push(`/${normalizedRoutePath}`);
    }

    if (rawPath.startsWith("/")) {
      const nestedFilesIndex = rawPath.lastIndexOf("/files/");
      if (nestedFilesIndex > 0) {
        routeCandidates.push(rawPath.slice(nestedFilesIndex));
      }

      routeCandidates.push(rawPath);
    }

    for (const candidate of routeCandidates) {
      const route = getWorkspaceRouteRequestPath(candidate);
      if (route && this.routeGroupMatches(route.groupId, groupId)) {
        return route.path;
      }
    }

    const routeDir = getFileRouteDirPath(groupId, filePath);
    const resolved = resolveHrefAgainstRoute(
      trimmed,
      routeDir,
      window.location.origin,
    );
    if (!resolved || resolved.origin !== window.location.origin) {
      return null;
    }

    const route = getWorkspaceRouteRequestPath(resolved.pathname);
    if (!route || !this.routeGroupMatches(route.groupId, groupId)) {
      return null;
    }

    return route.path;
  }

  resolveWorkspaceFileTarget(
    href: string,
    filePath: string,
    groupId: string,
  ): { groupId: string; path: string } | null {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return null;
    }

    const routeCandidates: string[] = [];
    let rawPath = trimmed.split(/[?#]/, 1)[0];

    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(rawPath) || rawPath.startsWith("//")) {
      let parsed: URL;
      try {
        parsed = new URL(rawPath, window.location.href);
      } catch {
        return null;
      }

      if (parsed.origin !== window.location.origin) {
        return null;
      }

      rawPath = parsed.pathname;
    }

    const normalizedRoutePath = rawPath.replace(/^(?:\.\/)+/u, "");
    if (normalizedRoutePath.startsWith("files/")) {
      routeCandidates.push(`/${normalizedRoutePath}`);
    }

    if (rawPath.startsWith("/")) {
      const nestedFilesIndex = rawPath.lastIndexOf("/files/");
      if (nestedFilesIndex > 0) {
        routeCandidates.push(rawPath.slice(nestedFilesIndex));
      }

      routeCandidates.push(rawPath);
    }

    for (const candidate of routeCandidates) {
      const route = getWorkspaceRouteRequestPath(candidate);
      if (!route) {
        continue;
      }

      const resolvedGroupId = this.resolveRouteGroupId(route.groupId, groupId);
      if (!resolvedGroupId) {
        continue;
      }

      return { groupId: resolvedGroupId, path: route.path };
    }

    const path = this.resolveWorkspaceLinkPath(trimmed, filePath, groupId);
    if (!path) {
      return null;
    }

    return { groupId, path };
  }

  resolveRouteGroupId(
    routeGroupId: string,
    expectedGroupId: string,
  ): string | null {
    if (
      routeGroupId === expectedGroupId ||
      this.routeGroupMatches(routeGroupId, expectedGroupId)
    ) {
      return expectedGroupId;
    }

    const groups = Array.isArray(orchestratorStore.groups)
      ? orchestratorStore.groups
      : [];
    const exact = groups.find((group) => group.groupId === routeGroupId);
    if (exact) {
      return exact.groupId;
    }

    const alias = groups.find((group) =>
      this.routeGroupMatches(routeGroupId, group.groupId),
    );
    if (alias) {
      return alias.groupId;
    }

    return routeGroupId || null;
  }

  routeGroupMatches(routeGroupId: string, expectedGroupId: string): boolean {
    if (routeGroupId === expectedGroupId) {
      return true;
    }

    if (!routeGroupId.includes(":") && !expectedGroupId.includes(":")) {
      return false;
    }

    const normalize = (value: string) => value.trim().replace(/:/g, "-");

    return normalize(routeGroupId) === normalize(expectedGroupId);
  }

  mimeTypeForImageExt(ext: string): string {
    const map: Record<string, string> = {
      apng: "image/apng",
      avif: "image/avif",
      gif: "image/gif",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      svg: "image/svg+xml",
      webp: "image/webp",
    };

    return map[ext] ?? "image/jpeg";
  }

  async readImageAsDataUrl(
    groupId: string,
    workspacePath: string,
  ): Promise<string | null> {
    if (!this.db) {
      return null;
    }

    try {
      const bytes = await readGroupFileBytes(this.db, groupId, workspacePath);
      const ext = workspacePath.split(".").pop()?.toLowerCase() || "";
      const mimeType = this.mimeTypeForImageExt(ext);

      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(new Blob([blobBytes], { type: mimeType }));
      });
    } catch {
      return null;
    }
  }

  async resolveRelativeImagesInHtml(
    html: string,
    filePath: string,
    groupId: string,
  ): Promise<string> {
    if (!html) {
      return html;
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    const images = Array.from(parsed.querySelectorAll("img[src]"));
    if (images.length === 0) {
      return html;
    }

    await Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute("src") || "";
        if (!src || /^(?:blob:|data:|#)/u.test(src)) {
          return;
        }

        const target = this.resolveWorkspaceFileTarget(src, filePath, groupId);
        if (!target) {
          return;
        }

        const dataUrl = await this.readImageAsDataUrl(
          target.groupId,
          target.path,
        );
        if (!dataUrl) {
          return;
        }

        img.setAttribute("src", dataUrl);
      }),
    );

    return parsed.body.innerHTML;
  }

  async resolveMarkdownImages(
    content: HTMLElement,
    groupId: string,
    filePath: string,
  ): Promise<void> {
    const images = Array.from(content.querySelectorAll("img[src]"));
    if (images.length === 0) {
      return;
    }

    await Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute("src") || "";
        if (!src || /^(?:blob:|data:|#)/u.test(src)) {
          return;
        }

        const target = this.resolveWorkspaceFileTarget(src, filePath, groupId);
        if (!target) {
          return;
        }

        const dataUrl = await this.readImageAsDataUrl(
          target.groupId,
          target.path,
        );
        if (!dataUrl) {
          return;
        }

        img.setAttribute("src", dataUrl);
      }),
    );
  }
}

customElements.define(elementName, ShadowClawPages);
