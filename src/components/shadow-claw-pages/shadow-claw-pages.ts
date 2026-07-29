import { renderMarkdown } from "../../content/markdown.js";

import {
  applyBasePath,
  getFileRouteDirPath,
  getWorkspaceRouteRequestPath,
  resolveHrefAgainstRoute,
} from "../../core/app-routes.js";

import { effect } from "../../core/effect.js";
import { getDb } from "../../db/db.js";

import {
  sanitizeSrcdocHtml,
  setSanitizedHtml,
  setTrustedSrcdoc,
} from "../../security/trusted-types.js";

import { readGroupFile } from "../../storage/readGroupFile.js";
import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";

import { orchestratorStore } from "../../stores/orchestrator.js";
import { fileViewerStore } from "../../stores/file-viewer.js";

import { showError, showSuccess, showWarning } from "../../ui/toast.js";

import type { Config } from "dompurify";

import type {
  GroupMeta,
  SavedPageRef,
  ShadowClawDatabase,
} from "../../db/types.js";

import ShadowClawElement from "../shadow-claw-element.js";

import "../shadow-claw-page-header/shadow-claw-page-header.js";
import shadowClawPagesStyles from "./shadow-claw-pages.css" with { type: "css" };
import shadowClawPagesTemplate from "./shadow-claw-pages.html" with { type: "html" };

const previewSanitizeOptions: Config = {
  // Allow blob URLs for locally resolved OPFS preview assets.
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

const elementName = "shadow-claw-pages";

export class ShadowClawPages extends ShadowClawElement {
  static styles = shadowClawPagesStyles;
  static template = shadowClawPagesTemplate;

  db: ShadowClawDatabase | null = null;

  previewFrameWindow: Window | null = null;

  renderToken: number = 0;

  sidebarOpen: boolean = false;
  draggedPageIndex: number | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    const host = this.closest("shadow-claw");
    let isOverride = false;
    try {
      isOverride =
        localStorage.getItem("shadow-claw-override-prerender-skeleton") ===
        "true";
    } catch {
      isOverride = false;
    }
    const isNoSeed = host?.getAttribute("data-prerender-no-seed") === "true";

    if (isOverride || isNoSeed) {
      const rendered = root.querySelector("[data-pages-rendered]");
      if (rendered instanceof HTMLElement) {
        rendered.hidden = true;
        rendered.textContent = "";
      }
    }

    this.db = await getDb();

    await orchestratorStore.whenInitialized;

    window.addEventListener("message", this.handleIframeMessage);

    root.addEventListener("click", (event: Event) => {
      const dropdown = root.querySelector("[data-pages-dropdown]");
      if (dropdown instanceof HTMLDetailsElement && dropdown.open) {
        const target = event.target as HTMLElement;
        const toggleBtn = root.querySelector("[data-pages-sidebar-toggle]");
        if (
          !dropdown.contains(target) &&
          (!toggleBtn || !toggleBtn.contains(target))
        ) {
          dropdown.removeAttribute("open");
        }
      }
    });

    const toggleBtn = root.querySelector("[data-pages-sidebar-toggle]");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.toggleSidebar();
      });
    }

    this.toggleSidebar(this.sidebarOpen);

    this.setupEffects();
  }

  async requestConfirmation(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> {
    const appShell = document.querySelector("shadow-claw") as any;
    if (appShell && typeof appShell.requestDialog === "function") {
      return await appShell.requestDialog({ mode: "confirm", ...options });
    }

    showWarning(options.message, 4500);

    return false;
  }

  toggleSidebar(force?: boolean) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dropdown = root.querySelector("[data-pages-dropdown]");
    const isDropdownOpen =
      dropdown instanceof HTMLDetailsElement && dropdown.open;

    let nextOpen: boolean;
    if (force !== undefined) {
      nextOpen = force;
    } else {
      nextOpen = !(isDropdownOpen || this.sidebarOpen);
    }

    this.sidebarOpen = nextOpen;

    const sidebar = root.querySelector(".pages__sidebar");
    const content = root.querySelector(".pages__content");

    if (sidebar) {
      sidebar.classList.toggle("collapsed", !this.sidebarOpen);
    }
    if (content) {
      content.classList.toggle(
        "pages__content--sidebar-collapsed",
        !this.sidebarOpen,
      );
    }

    if (dropdown instanceof HTMLDetailsElement) {
      if (nextOpen) {
        dropdown.setAttribute("open", "");
      } else {
        dropdown.removeAttribute("open");
      }
    }
  }

  async handleReorder(fromIndex: number, toIndex: number) {
    if (!this.db || fromIndex === toIndex) {
      return;
    }

    const pages = [...orchestratorStore.pages];
    if (
      fromIndex < 0 ||
      fromIndex >= pages.length ||
      toIndex < 0 ||
      toIndex >= pages.length
    ) {
      return;
    }

    const [moved] = pages.splice(fromIndex, 1);
    pages.splice(toIndex, 0, moved);

    await orchestratorStore.reorderPages(this.db, pages);

    if (toIndex === 0 && moved) {
      this.selectedPage = moved;
      void this.renderSelectedPage();

      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail: {
            page: "pages",
            groupId: moved.groupId,
            path: moved.path,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.handleIframeMessage);
    this.previewFrameWindow = null;
    super.disconnectedCallback?.();
  }

  getPageRouteDirectory(filePath: string): string {
    const groupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;

    return applyBasePath(getFileRouteDirPath(groupId, filePath));
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

  isHtmlPath(path: string): boolean {
    return /\.(html?|xhtml)$/iu.test(path);
  }

  isMarkdownPath(path: string): boolean {
    return /\.(md|markdown)$/iu.test(path);
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
          const globalIndex = pages.findIndex(
            (p) => p.path === page.path && p.groupId === page.groupId,
          );

          const row = document.createElement("div");
          row.className = "pages__list-item";
          if (
            this.selectedPage &&
            this.pageRefKey(page) === this.pageRefKey(this.selectedPage)
          ) {
            row.classList.add("active");
          }

          const dragHandle = document.createElement("span");
          dragHandle.className = "pages__drag-handle";
          dragHandle.setAttribute("draggable", "true");
          dragHandle.title = "Drag to reorder";
          dragHandle.textContent = "⠿";

          dragHandle.addEventListener("dragstart", (e) => {
            this.draggedPageIndex = globalIndex;
            row.classList.add("dragging");
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = "move";
            }
          });

          row.addEventListener("dragend", () => {
            this.draggedPageIndex = null;
            row.classList.remove("dragging");
          });

          row.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (
              this.draggedPageIndex !== null &&
              this.draggedPageIndex !== globalIndex
            ) {
              row.classList.add("drag-over");
            }
          });

          row.addEventListener("dragleave", () => {
            row.classList.remove("drag-over");
          });

          row.addEventListener("drop", (e) => {
            e.preventDefault();
            row.classList.remove("drag-over");
            if (
              this.draggedPageIndex !== null &&
              this.draggedPageIndex !== globalIndex
            ) {
              void this.handleReorder(this.draggedPageIndex, globalIndex);
            }
          });

          const effectiveDefault = orchestratorStore.effectiveDefaultPage;
          const isDefault =
            effectiveDefault &&
            effectiveDefault.path === page.path &&
            effectiveDefault.groupId === page.groupId;

          const selectBtn = document.createElement("button");
          selectBtn.type = "button";
          selectBtn.className = "pages__select";
          selectBtn.title = `Open ${path}`;

          const pathSpan = document.createElement("span");
          pathSpan.className = "pages__list-path";
          pathSpan.textContent = path;
          selectBtn.appendChild(pathSpan);

          selectBtn.addEventListener("click", () => {
            this.selectedPage = page;
            this.renderPageList(
              orchestratorStore.pages,
              orchestratorStore.groups,
            );
            void this.renderSelectedPage();

            this.sidebarOpen = false;
            const details = list.closest("details");
            if (details) {
              details.removeAttribute("open");
            }

            document.dispatchEvent(
              new CustomEvent("shadow-claw-navigate", {
                detail: {
                  page: "pages",
                  groupId: page.groupId,
                  path: page.path,
                },
                bubbles: true,
                composed: true,
              }),
            );
          });

          const editBtn = document.createElement("button");
          editBtn.className = "pages__edit";
          editBtn.type = "button";
          editBtn.title = "Edit in file editor";
          editBtn.setAttribute("aria-label", `Edit ${path} in file editor`);
          editBtn.textContent = "✏️";

          editBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            if (!this.db) {
              return;
            }
            try {
              await fileViewerStore.openFile(this.db, path, groupId);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              showError(`Failed to edit file: ${message}`, 4500);
            }
          });

          const removeBtn = document.createElement("button");
          removeBtn.className = "pages__remove";
          removeBtn.type = "button";
          removeBtn.title = "Remove from Pages";
          removeBtn.setAttribute(
            "aria-label",
            `Remove ${path} from Pages in ${(groupNameById.get(groupId) || groupId) as string}`,
          );
          removeBtn.textContent = "✕";

          removeBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            if (!this.db) {
              return;
            }

            const confirmed = await this.requestConfirmation({
              title: "Remove Page",
              message: `Are you sure you want to remove this page from Pages?\n\n${path}`,
              confirmLabel: "Remove",
              cancelLabel: "Cancel",
            });

            if (!confirmed) {
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

          row.appendChild(dragHandle);
          if (isDefault) {
            const defaultSpan = document.createElement("span");
            defaultSpan.className = "pages__default-btn is-default";
            defaultSpan.title = "Default page";
            defaultSpan.textContent = "⭐";
            row.appendChild(defaultSpan);
          }
          row.appendChild(selectBtn);
          row.appendChild(editBtn);
          row.appendChild(removeBtn);
          list.appendChild(row);
        });
      }
    });
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

  setupEffects() {
    this.addCleanup(
      effect(() => {
        const pages = orchestratorStore.pages;
        const groups = orchestratorStore.groups;
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
          this.selectedPage =
            orchestratorStore.effectiveDefaultPage || pages[0];
        }

        void this.renderSelectedPage();
      }),
    );
  }

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
    const bridgeScriptUrl = applyBasePath(
      "/assets/file-viewer-preview-bridge.js",
    );

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

  private pageRefKey(page: SavedPageRef | null): string {
    if (!page) {
      return "";
    }

    return `${page.groupId}\u0000${page.path}`;
  }

  private removePreviewIframe(root: ShadowRoot): void {
    const iframe = root.querySelector("[data-pages-iframe]");
    if (!(iframe instanceof HTMLIFrameElement)) {
      return;
    }

    iframe.removeAttribute("srcdoc");
    iframe.remove();
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawPages);
}
