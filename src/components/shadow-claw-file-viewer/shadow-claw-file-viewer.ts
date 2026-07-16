import hljs from "highlight.js";

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
  toTrustedHtmlPresanitized,
} from "../../security/trusted-types.js";

import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";
import { writeGroupFile } from "../../storage/writeGroupFile.js";

import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { themeStore } from "../../stores/theme.js";

import { showError, showSuccess } from "../../ui/toast.js";

import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-pdf-viewer/shadow-claw-pdf-viewer.js";

import type { Config } from "dompurify";
import type { ShadowClawDatabase } from "../../db/types.js";

import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawFileViewerStyles from "./shadow-claw-file-viewer.css" with { type: "css" };
import shadowClawFileViewerTemplate from "./shadow-claw-file-viewer.html" with { type: "html" };

const elementName = "shadow-claw-file-viewer";
const highlightThemePath = `components/${elementName}/highlightjs-atom-one-dark.min.css`;
const highlightFontOverrideCss =
  "pre code.hljs, code.hljs, .hljs { font-family: var(--shadow-claw-font-mono) !important; }";

const previewSanitizeOptions: Config = {
  // Allow blob URLs for locally resolved OPFS preview assets.
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * ShadowClawFileViewer - component for viewing and editing files
 */
export class ShadowClawFileViewer extends ShadowClawElement {
  static styles = shadowClawFileViewerStyles;
  static template = shadowClawFileViewerTemplate;

  currentImageObjectUrls: string[] = [];
  currentObjectUrl: string | null = null;

  db: ShadowClawDatabase | null = null;
  editorDraftContent: string | null = null;

  isEditorDirty: boolean = false;
  isFileEditMode: boolean = false;

  isFilePreviewMode: boolean = false;
  isFullscreenMode: boolean = false;

  lastOpenedFileName: string = "";
  previewFrameWindow: Window | null = null;
  viewRenderToken: number = 0;

  constructor() {
    super();
  }

  async connectedCallback() {

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();

    // Apply highlight.js theme to markdown preview output in this shadow root.
    const hjsCss = await fetch(highlightThemePath).then((r) => r.text());
    this.applyHighlightStyles(hjsCss);

    window.addEventListener("message", this.handleIframeMessage);
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);

    this.setupEffects();
    this.bindEventListeners();
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.handleIframeMessage);
    document.removeEventListener(
      "fullscreenchange",
      this.handleFullscreenChange,
    );
    this.revokeObjectUrl();
  }

  applyFullscreenMode(modal: Element) {
    const modalContent = modal.querySelector(".modal-content");
    if (modalContent instanceof HTMLElement) {
      modalContent.classList.toggle(
        "modal-content--fullscreen",
        this.isFullscreenMode,
      );
    }

    const fullscreenBtn = modal.querySelector(".modal-fullscreen-btn");
    if (fullscreenBtn instanceof HTMLButtonElement) {
      fullscreenBtn.setAttribute("aria-pressed", String(this.isFullscreenMode));
      fullscreenBtn.setAttribute(
        "aria-label",
        this.isFullscreenMode ? "Exit fullscreen" : "Enter fullscreen",
      );
      fullscreenBtn.title = this.isFullscreenMode
        ? "Exit fullscreen"
        : "Fullscreen";
    }
  }

  applyHighlightStyles(hjsCss: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const supportsConstructedSheet =
      typeof CSSStyleSheet !== "undefined" &&
      typeof CSSStyleSheet.prototype.replaceSync === "function";

    if (supportsConstructedSheet && "adoptedStyleSheets" in root) {
      try {
        const themeSheet = new CSSStyleSheet();
        themeSheet.replaceSync(hjsCss);

        const fontSheet = new CSSStyleSheet();
        fontSheet.replaceSync(highlightFontOverrideCss);

        const existingSheets = root.adoptedStyleSheets
          ? Array.from(root.adoptedStyleSheets)
          : [];
        root.adoptedStyleSheets = [...existingSheets, themeSheet, fontSheet];

        return;
      } catch {
        // Some engines expose pieces of the API but fail at runtime.
      }
    }

    const style = document.createElement("style");
    style.setAttribute("data-shadow-claw-highlight-theme", "true");
    style.textContent = `${hjsCss}\n${highlightFontOverrideCss}`;
    root.appendChild(style);
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modal = root.querySelector(".file-modal");
    modal?.addEventListener("cancel", (event: Event) => {
      event.preventDefault();
      void this.requestCloseViewer();
    });
    modal?.addEventListener("close", () => {
      if (fileViewerStore.file) {
        fileViewerStore.closeFile();
      }
    });

    const closeBtn = root.querySelector(".modal-close-btn");
    closeBtn?.addEventListener("click", () => void this.requestCloseViewer());

    const previewBtn = root.querySelector(".modal-preview-btn");
    previewBtn?.addEventListener("click", async () => {
      this.isFilePreviewMode = !this.isFilePreviewMode;
      this.isFileEditMode = false;
      await this.updateView();
    });

    const fullscreenBtn = root.querySelector(".modal-fullscreen-btn");
    fullscreenBtn?.addEventListener("click", () => {
      if (modal) {
        void this.toggleFullscreenMode(modal);
      }
    });

    const shareBtn = root.querySelector(".modal-share-btn");
    shareBtn?.addEventListener("click", async () => {
      await this.handleShareFile();
    });

    const editBtn = root.querySelector(".modal-edit-btn");
    editBtn?.addEventListener("click", async () => {
      this.isFileEditMode = !this.isFileEditMode;
      if (this.isFileEditMode) {
        this.isFilePreviewMode = false;
      }

      await this.updateView();
    });

    const saveBtn = root.querySelector(".modal-save-btn");
    saveBtn?.addEventListener("click", () => this.handleSave());

    const cancelBtn = root.querySelector(".modal-cancel-btn");
    cancelBtn?.addEventListener("click", async () => {
      this.isEditorDirty = false;
      this.editorDraftContent = null;
      this.isFileEditMode = false;
      await this.updateView();
    });
    const editor = root.querySelector(".file-editor");

    editor?.addEventListener("input", () => {
      if (editor instanceof HTMLTextAreaElement) {
        this.editorDraftContent = editor.value;
        this.updateEditorHighlight(editor.value);
      }

      this.isEditorDirty = true;
      void this.updateView();
    });

    if (editor instanceof HTMLTextAreaElement) {
      const syncHighlight = () => {
        const highlightPre = root.querySelector(".file-editor-overlay");
        if (highlightPre) {
          highlightPre.scrollTop = editor.scrollTop;
          highlightPre.scrollLeft = editor.scrollLeft;
        }
      };

      editor.addEventListener("scroll", syncHighlight);
      editor.addEventListener("focus", syncHighlight);
      editor.addEventListener("click", syncHighlight);
      editor.addEventListener("keyup", syncHighlight);
      editor.addEventListener("mouseup", syncHighlight);

      const scrollBody = root.querySelector(".modal-body");
      scrollBody?.addEventListener("scroll", syncHighlight);
    }
  }

  buildWebShareFile(file: any): File | null {
    if (file?.nativeFile instanceof File) {
      return file.nativeFile;
    }

    const bytes = file?.binaryContent;
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      return null;
    }

    const fileBytes = new Uint8Array(bytes.byteLength);
    fileBytes.set(bytes);

    return new File([fileBytes], file.name || "shared-file", {
      type: file?.mimeType || "application/octet-stream",
    });
  }

  canShareCurrentFile(file: any) {
    if (!file || !this.isWebShareAvailable()) {
      return false;
    }

    if (file.kind === "text") {
      return true;
    }

    const shareFile = this.buildWebShareFile(file);
    if (!shareFile || typeof navigator.canShare !== "function") {
      return false;
    }

    try {
      return navigator.canShare({ files: [shareFile] });
    } catch {
      return false;
    }
  }

  canUseNativeFullscreen(target: HTMLElement): target is HTMLElement & {
    requestFullscreen: () => Promise<void>;
  } {
    return (
      document.fullscreenEnabled === true &&
      (typeof (target as any).requestFullscreen === "function" ||
        typeof (target as any).webkitRequestFullscreen === "function") &&
      (typeof document.exitFullscreen === "function" ||
        typeof (document as any).webkitExitFullscreen === "function")
    );
  }

  getCurrentFullscreenElement(): Element | null {
    return (
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      null
    );
  }

  getFullscreenTarget(modal: Element): HTMLElement | null {
    const modalContent = modal.querySelector(".modal-content");
    if (!(modalContent instanceof HTMLElement)) {
      return null;
    }

    return modalContent;
  }

  getIframeBridgeScriptUrl() {
    return applyBasePath("/assets/file-viewer-preview-bridge.js");
  }

  getIframeSandboxPermissions(fileName: string) {
    if (/\.svg$/i.test(fileName)) {
      return "allow-modals allow-popups allow-popups-to-escape-sandbox";
    }

    return "allow-modals allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin";
  }

  getLanguageFromFilename(fileName: string) {
    const extension = fileName.toLowerCase().split(".").pop() || "";
    const languageMap: Record<string, string> = {
      bash: "bash",
      cjs: "javascript",
      css: "css",
      html: "xml",
      java: "java",
      javascript: "javascript",
      js: "javascript",
      json: "json",
      jsx: "jsx",
      markdown: "markdown",
      md: "markdown",
      mjs: "javascript",
      php: "php",
      python: "python",
      py: "python",
      ruby: "ruby",
      rb: "ruby",
      rust: "rust",
      rs: "rust",
      sh: "bash",
      sql: "sql",
      svg: "xml",
      ts: "typescript",
      tsx: "tsx",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
    };

    return languageMap[extension] || "";
  }

  getPreviewSourceFile(file: any, modal: HTMLElement) {
    return this.getWorkingSourceFile(file, modal);
  }

  getWorkingSourceFile(file: any, modal: HTMLElement) {
    if (!this.isEditorDirty || file?.kind !== "text") {
      return file;
    }

    if (typeof this.editorDraftContent === "string") {
      return {
        ...file,
        content: this.editorDraftContent,
      };
    }

    const editor = modal.querySelector(".file-editor");
    if (!(editor instanceof HTMLTextAreaElement)) {
      return file;
    }

    return {
      ...file,
      content: editor.value,
    };
  }

  getWorkspaceRouteTarget(
    value: string,
    options: { allowCrossGroup?: boolean } = {},
  ): { groupId: string; path: string } | null {
    const { allowCrossGroup = false } = options;

    let pathOnly = value.split(/[?#]/, 1)[0].trim();
    if (!pathOnly) {
      return null;
    }

    if (
      /^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(pathOnly) ||
      pathOnly.startsWith("//")
    ) {
      let parsed: URL;
      try {
        parsed = new URL(pathOnly, window.location.href);
      } catch {
        return null;
      }

      if (parsed.origin !== window.location.origin) {
        return null;
      }

      pathOnly = parsed.pathname;
    }

    const dotPrefixedFilesPath = pathOnly.replace(/^(?:\.\/)+/u, "");
    const candidates: string[] = [];

    if (dotPrefixedFilesPath.startsWith("files/")) {
      candidates.push(`/${dotPrefixedFilesPath}`);
    }

    if (pathOnly.startsWith("/")) {
      const nestedFilesIndex = pathOnly.lastIndexOf("/files/");
      if (nestedFilesIndex > 0) {
        candidates.push(pathOnly.slice(nestedFilesIndex));
      }

      candidates.push(pathOnly);
    }

    for (const candidate of candidates) {
      const route = getWorkspaceRouteRequestPath(candidate);
      if (!route) {
        continue;
      }

      const resolvedGroupId = this.resolveRouteGroupId(route.groupId);
      if (!resolvedGroupId) {
        continue;
      }

      if (
        !allowCrossGroup &&
        resolvedGroupId !== orchestratorStore.activeGroupId
      ) {
        continue;
      }

      return { groupId: resolvedGroupId, path: route.path };
    }

    return null;
  }

  handleAnchorNavigation(anchor: string): boolean {
    const root = this.shadowRoot;
    if (!root) {
      return false;
    }

    const content = root.querySelector(".file-content") as HTMLElement;
    if (!content) {
      return false;
    }

    // Clear any existing highlighted lines
    content.querySelectorAll(".code-line.highlighted").forEach((el) => {
      el.classList.remove("highlighted");
    });

    const lineMatch = anchor.match(/^#?L(\d+)(?:-L?(\d+))?$/i);
    if (lineMatch) {
      const startLine = parseInt(lineMatch[1], 10);
      const endLine = lineMatch[2] ? parseInt(lineMatch[2], 10) : startLine;

      let firstHighlightedEl: HTMLElement | null = null;
      const codeLines = content.querySelectorAll(".code-line");
      codeLines.forEach((el) => {
        const lineNum = parseInt(el.getAttribute("data-line") || "0", 10);
        if (lineNum >= startLine && lineNum <= endLine) {
          el.classList.add("highlighted");
          if (!firstHighlightedEl) {
            firstHighlightedEl = el as HTMLElement;
          }
        }
      });

      if (firstHighlightedEl) {
        (firstHighlightedEl as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        return true;
      }

      return false;
    } else {
      const id = anchor.replace(/^#/, "");
      const targetEl =
        content.querySelector(`[id="${id}"]`) ||
        content.querySelector(`a[name="${id}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });

        return true;
      }

      return false;
    }
  }

  handleFullscreenChange = () => {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modal = root.querySelector(".file-modal");
    if (!(modal instanceof HTMLElement)) {
      return;
    }

    const fullscreenTarget = this.getFullscreenTarget(modal);
    this.isFullscreenMode = this.isTargetInFullscreen(fullscreenTarget);
    this.applyFullscreenMode(modal);
  };

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

    const current = fileViewerStore.file;
    const filePath = current?.path || current?.name || "";
    const routeDir = getFileRouteDirPath(
      orchestratorStore.activeGroupId,
      filePath,
    );
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

  hasUnsavedChanges() {
    return this.isEditorDirty;
  }

  isIframePreviewFile(fileName: string) {
    return /\.(?:html?|svg)$/i.test(fileName);
  }

  isMarkdownLikeFile(fileName: string) {
    return /(?:^readme$|\.mdx?$|\.markdown$|\.mdown$)/i.test(fileName);
  }

  isNodeInComposedTree(node: Node | null, ancestor: Node): boolean {
    let current: Node | null = node;

    while (current) {
      if (current === ancestor) {
        return true;
      }

      if (current.parentNode) {
        current = current.parentNode;

        continue;
      }

      const root = current.getRootNode?.();
      if (root instanceof ShadowRoot && root.host) {
        current = root.host;

        continue;
      }

      current = null;
    }

    return false;
  }

  isRenderTokenCurrent(renderToken: number) {
    return this.viewRenderToken === renderToken;
  }

  isTargetInFullscreen(target: HTMLElement | null): boolean {
    if (!target) {
      return false;
    }

    const current = this.getCurrentFullscreenElement();
    if (!current) {
      return false;
    }

    return (
      current === target ||
      this.isNodeInComposedTree(target, current) ||
      this.isNodeInComposedTree(current, target)
    );
  }

  isWebShareAvailable() {
    return (
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
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

  renderBinaryPreview(content: HTMLElement, file: any) {
    const mimeType = file.mimeType || "application/octet-stream";

    if (file.nativeFile instanceof File) {
      this.currentObjectUrl = URL.createObjectURL(file.nativeFile);
    } else {
      const bytes = file.binaryContent;
      if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
        content.classList.remove("file-content--raw", "file-content--iframe");
        content.classList.add("file-content--preview");
        content.textContent = "Binary content unavailable.";

        return;
      }

      // Copy into a plain ArrayBuffer-backed view so BlobPart typing is stable in checkJs.
      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);

      const blob = new Blob([blobBytes], { type: mimeType });
      this.currentObjectUrl = URL.createObjectURL(blob);
    }

    content.classList.remove("file-content--raw", "file-content--preview");
    content.classList.add("file-content--iframe");

    if (mimeType.startsWith("image/")) {
      const image = document.createElement("img");
      image.className = "file-content-iframe";
      image.alt = `Preview: ${file.name}`;
      image.src = this.currentObjectUrl;
      image.style.objectFit = "contain";

      content.replaceChildren(image);

      return;
    }

    if (mimeType.startsWith("video/")) {
      const video = document.createElement("video");
      video.className = "file-content-iframe";
      video.controls = true;
      video.src = this.currentObjectUrl;
      video.style.backgroundColor = "black";

      content.replaceChildren(video);

      return;
    }

    if (mimeType.startsWith("audio/")) {
      const audioWrap = document.createElement("div");
      audioWrap.className = "file-content file-content--preview";
      audioWrap.style.padding = "1rem";

      const label = document.createElement("p");
      label.textContent = file.name;

      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = this.currentObjectUrl;
      audio.style.width = "100%";

      audioWrap.replaceChildren(label, audio);
      content.replaceChildren(audioWrap);
      content.classList.remove("file-content--iframe");

      return;
    }

    const iframe = document.createElement("iframe");
    iframe.className = "file-content-iframe";
    iframe.setAttribute("title", `Preview: ${file.name}`);
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.src = this.currentObjectUrl;

    content.replaceChildren(iframe);
  }

  resetContent() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modal = root.querySelector(".file-modal");
    if (!(modal instanceof HTMLElement)) {
      return;
    }

    const fullscreenTarget = this.getFullscreenTarget(modal);
    if (fullscreenTarget && this.isTargetInFullscreen(fullscreenTarget)) {
      void this.exitNativeFullscreen().catch(() => {
        // noop
      });
    }

    this.isFullscreenMode = false;
    this.applyFullscreenMode(modal);

    const content = modal.querySelector(".file-content");
    const previewBtn = modal.querySelector(".modal-preview-btn");

    if (previewBtn instanceof HTMLButtonElement) {
      previewBtn.setAttribute("aria-pressed", "false");
      previewBtn.setAttribute("aria-label", "Switch to preview mode");
    }

    const editBtn = modal.querySelector(".modal-edit-btn");
    if (editBtn instanceof HTMLButtonElement) {
      editBtn.setAttribute("aria-pressed", "false");
      editBtn.setAttribute("aria-label", "Edit file");
      editBtn.classList.remove("hidden");
    }

    const closeBtn = modal.querySelector(".modal-close-btn");
    if (closeBtn instanceof HTMLButtonElement) {
      closeBtn.disabled = false;
      closeBtn.setAttribute("aria-label", "Close file viewer");
      closeBtn.title = "Close";
    }

    const saveBtn = modal.querySelector(".modal-save-btn");
    saveBtn?.classList.add("hidden");

    const editorContainer = modal.querySelector(".file-editor-container");
    editorContainer?.classList.remove("active");

    const modalBody = modal.querySelector(".modal-body");
    modalBody?.classList.remove("modal-body--editing");

    const editor = modal.querySelector(".file-editor");
    if (editor instanceof HTMLTextAreaElement) {
      editor.value = "";
      editor.removeAttribute("language");
    }

    const highlightCode = modal.querySelector(".file-editor-overlay code");
    if (highlightCode) {
      highlightCode.innerHTML = "";
      highlightCode.className = "hljs";
    }

    this.isFileEditMode = false;
    this.editorDraftContent = null;

    if (!(content instanceof HTMLElement)) {
      return;
    }

    this.revokeObjectUrl();

    content.classList.remove("hidden");
    content.classList.add("file-content--raw");
    content.classList.remove("file-content--preview", "file-content--iframe");
    content.textContent = "";
  }

  resolveRouteGroupId(routeGroupId: string): string | null {
    const expectedGroupId = orchestratorStore.activeGroupId;
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

    const workspaceRouteTarget = this.getWorkspaceRouteTarget(candidate);
    if (workspaceRouteTarget) {
      return workspaceRouteTarget.path;
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

  revokeObjectUrl() {
    this.previewFrameWindow = null;

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    for (const url of this.currentImageObjectUrls) {
      URL.revokeObjectURL(url);
    }

    this.currentImageObjectUrls = [];
  }

  rewriteWorkspacePreviewHtml(html: string, filePath: string): string {
    if (!html) {
      return html;
    }

    const routeDir = getFileRouteDirPath(
      orchestratorStore.activeGroupId,
      filePath,
    );
    const parsed = new DOMParser().parseFromString(html, "text/html");

    const rewriteUrlAttribute = (
      selector: string,
      attribute: "href" | "src",
    ) => {
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
        if (!resolved) {
          continue;
        }

        if (resolved.origin !== window.location.origin) {
          continue;
        }

        node.setAttribute(
          attribute,
          `${resolved.pathname}${resolved.search}${resolved.hash}`,
        );
      }
    };

    rewriteUrlAttribute("a[href]", "href");
    rewriteUrlAttribute("img[src]", "src");
    rewriteUrlAttribute("audio[src]", "src");
    rewriteUrlAttribute("video[src]", "src");
    rewriteUrlAttribute("source[src]", "src");

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

  setupEffects() {
    effect(() => {
      const file = fileViewerStore.file;
      const renderToken = ++this.viewRenderToken;
      const root = this.shadowRoot;
      if (!root) {
        return;
      }

      const modal = root.querySelector(".file-modal");
      if (!(modal instanceof HTMLDialogElement)) {
        return;
      }

      if (file) {
        if (!modal.open) {
          modal.showModal();
        }

        const title = modal.querySelector(".modal-title");
        if (title instanceof HTMLElement) {
          title.textContent = `File: ${file.name}`;
        }

        if (this.lastOpenedFileName !== file.name) {
          this.lastOpenedFileName = file.name;
          this.isFilePreviewMode = this.shouldAutoPreview(file);
          this.isFileEditMode = false;
          this.isEditorDirty = false;
          this.editorDraftContent = null;
        }

        // async / await
        void this.updateView(renderToken);
      } else {
        if (modal.open) {
          modal.close();
        }

        this.lastOpenedFileName = "";
        this.isFilePreviewMode = false;
        this.isEditorDirty = false;
        this.editorDraftContent = null;

        this.resetContent();
      }
    });
  }

  shouldAutoPreview(file: any) {
    if (!file || typeof file !== "object") {
      return false;
    }

    if (file.kind === "pdf" || file.kind === "binary") {
      return true;
    }

    if (file.kind === "text") {
      return (
        this.isIframePreviewFile(file.name) ||
        this.isMarkdownLikeFile(file.name)
      );
    }

    return false;
  }

  toPreviewMarkdown(file: any) {
    if (this.isMarkdownLikeFile(file.name)) {
      return file.content;
    }

    const lang = this.getLanguageFromFilename(file.name);

    return "```" + lang + "\n" + file.content + "\n```";
  }

  updateEditorHighlight(value: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const highlightCode = root.querySelector(".file-editor-overlay code");
    if (!highlightCode) {
      return;
    }

    const file = fileViewerStore.file;
    const language = this.getLanguageFromFilename(file?.name || "");
    let highlighted = "";

    try {
      if (language && hljs.getLanguage(language)) {
        highlighted = hljs.highlight(value, { language }).value;
      } else {
        highlighted = hljs.highlightAuto(value).value;
      }
    } catch {
      highlighted = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    highlightCode.className = language ? `hljs language-${language}` : "hljs";
    // hljs output is pre-sanitized: user content is entity-escaped and
    // only generated <span class="hljs-*"> tags are added. Use
    // toTrustedHtmlPresanitized to satisfy Trusted Types without
    // running DOMPurify (which would strip the hljs span tokens).
    highlightCode.innerHTML = toTrustedHtmlPresanitized(
      highlighted + "<br>",
    ) as string;
  }

  wrapCodeLines(content: HTMLElement) {
    const codeBlocks = content.querySelectorAll("pre code");
    codeBlocks.forEach((codeEl) => {
      const htmlContent = codeEl.innerHTML;
      const lines = htmlContent.split(/\r?\n/u);

      if (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
      }

      const wrappedHtml = lines
        .map((line, idx) => {
          const lineNum = idx + 1;

          return `<span class="code-line" data-line="${lineNum}">${line || "&nbsp;"}</span>`;
        })
        .join("\n");
      setSanitizedHtml(codeEl, wrappedHtml);
    });
  }

  async buildIframePreviewSrcdoc(file: any) {
    if (/\.svg$/i.test(file.name)) {
      return file.content;
    }

    const filePath = file.path || file.name || "";
    const resolvedHtml = this.rewriteWorkspacePreviewHtml(
      file.content || "",
      filePath,
    );
    const htmlContent = await this.resolveRelativeImagesInHtml(
      resolvedHtml,
      filePath,
    );

    const safeContent = sanitizeSrcdocHtml(htmlContent, previewSanitizeOptions);

    // A per-render nonce restricts script execution inside the sandboxed iframe
    // to only the reviewed same-origin bridge script. Inline scripts and any
    // other external scripts are blocked even though allow-scripts is required
    // for the bridge to run at all (sandbox cannot be removed without losing
    // link interception).
    const nonce = crypto.randomUUID().replace(/-/g, "");

    return (
      "<!doctype html>" +
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'">` +
      `<base href="${applyBasePath(getFileRouteDirPath(orchestratorStore.activeGroupId, filePath))}" target="_blank">` +
      `<script src="${this.getIframeBridgeScriptUrl()}" nonce="${nonce}"><\/script>` +
      "<style>" +
      `  :root { color-scheme: ${themeStore.resolved}; }` +
      "  body { font-family: system-ui, -apple-system, sans-serif; color: CanvasText; background-color: Canvas; }" +
      "  a { color: LinkText; }" +
      "  img { max-width: 100%; max-height: 100%; }" +
      "</style>" +
      "</head><body>" +
      safeContent +
      "</body></html>"
    );
  }

  async canDismissViewer() {
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    const confirmed = await this.requestConfirmation({
      title: "Discard Unsaved Changes",
      message: "You have unsaved changes. Discard them and close?",
      confirmLabel: "Discard",
      cancelLabel: "Keep Editing",
    });

    if (confirmed) {
      this.isEditorDirty = false;
      this.editorDraftContent = null;
    }

    return confirmed;
  }

  async exitFullscreenIfActive(modal?: Element): Promise<void> {
    const root = this.shadowRoot;
    const activeModal = modal || root?.querySelector(".file-modal");
    if (!activeModal) {
      return;
    }

    const fullscreenTarget = this.getFullscreenTarget(activeModal);
    if (!fullscreenTarget || !this.isTargetInFullscreen(fullscreenTarget)) {
      return;
    }

    try {
      await this.exitNativeFullscreen();
    } catch {
      // Native fullscreen exit can fail if browser blocks it.
    }
  }

  async exitNativeFullscreen(): Promise<void> {
    const exit =
      document.exitFullscreen || (document as any).webkitExitFullscreen;
    if (typeof exit !== "function") {
      throw new Error("Native fullscreen exit unavailable");
    }

    await Promise.resolve(exit.call(document));
  }

  async handlePreviewLinkClick(event: MouseEvent) {
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
    if (!(link instanceof HTMLAnchorElement) || !this.db) {
      return;
    }

    const current = fileViewerStore.file;
    const basePath = current?.path || current?.name || "";
    const href = link.getAttribute("href") || "";
    const routeDir = getFileRouteDirPath(
      orchestratorStore.activeGroupId,
      basePath,
    );
    const resolved = resolveHrefAgainstRoute(
      href,
      routeDir,
      window.location.origin,
    );

    if (resolved && resolved.origin === window.location.origin) {
      event.preventDefault();
      const targetPath = `${resolved.pathname}${resolved.search}${resolved.hash}`;
      const nav = (window as any).navigation;
      if (nav && typeof nav.navigate === "function") {
        nav.navigate(targetPath);
      } else {
        window.history.pushState({}, "", targetPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }

      return;
    }

    const trimmed = href.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("javascript:")
    ) {
      const targetAttr = link.getAttribute("target") || "_blank";
      const safeTarget =
        targetAttr === "_self" ||
        targetAttr === "_top" ||
        targetAttr === "_parent"
          ? "_blank"
          : targetAttr;

      try {
        const parsed = new URL(trimmed, window.location.href);
        const isExternal = parsed.host !== window.location.host;
        if (isExternal) {
          event.preventDefault();
          window.open(trimmed, safeTarget, "noopener,noreferrer");
        }
      } catch {
        if (/^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(trimmed)) {
          event.preventDefault();
          window.open(trimmed, safeTarget, "noopener,noreferrer");
        }
      }
    }
  }

  async handleSave() {
    const file = fileViewerStore.file;
    if (!file || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    const saveBtn = root?.querySelector(".modal-save-btn");
    const editor = root?.querySelector(".file-editor");

    if (!(editor instanceof HTMLTextAreaElement)) {
      return;
    }

    try {
      if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.disabled = true;
        saveBtn.textContent = "⏳ saving...";
      }

      const newContent = editor.value;
      const filePath =
        orchestratorStore.currentPath === "."
          ? file.name
          : `${orchestratorStore.currentPath}/${file.name}`;

      await writeGroupFile(
        this.db,
        orchestratorStore.activeGroupId,
        filePath,
        newContent,
      );

      showSuccess(`Saved ${file.name}`);
      await orchestratorStore.loadFiles(this.db);

      file.content = newContent;
      this.isFileEditMode = false;
      this.isEditorDirty = false;
      this.editorDraftContent = null;

      await this.updateView();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      showError(`Failed to save file: ${message}`);
    } finally {
      if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 Save";
      }
    }
  }

  async handleShareFile() {
    const file = fileViewerStore.file;
    if (!file || !this.canShareCurrentFile(file)) {
      showError("Sharing is not supported for this file on this device.", 4500);

      return;
    }

    try {
      if (file.kind === "text") {
        await navigator.share({
          title: file.name,
          text: file.content || "",
        });
      } else {
        const shareFile = this.buildWebShareFile(file);
        if (!shareFile || !navigator.canShare?.({ files: [shareFile] })) {
          showError("File sharing is not supported on this device.", 4500);

          return;
        }

        await navigator.share({
          title: file.name,
          files: [shareFile],
        });
      }

      showSuccess(`Shared ${file.name}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to share file: ${message}`, 5000);
    }
  }

  async openFolderInFilesView(path: string) {
    if (!this.db) {
      return;
    }

    const normalizedPath = path.replace(/^\/+|\/+$/g, "");
    if (!normalizedPath) {
      return;
    }

    try {
      await orchestratorStore.setCurrentPath(this.db, normalizedPath);
      fileViewerStore.closeFile();

      const maybeUi = (window as any)?.shadowclaw?.ui;
      if (maybeUi && typeof maybeUi.showPage === "function") {
        maybeUi.showPage("files");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to open linked folder: ${message}`, 5000);
    }
  }

  async openWorkspaceLink(href: string, basePath: string) {
    if (!this.db) {
      return;
    }

    const resolved = this.resolveWorkspaceLinkPath(href, basePath);
    if (!resolved) {
      return;
    }

    const lastSegment = resolved.split("/").filter(Boolean).pop() || "";
    const hasExtension = /\.[^./]+$/u.test(lastSegment);

    if (!hasExtension) {
      // Try opening the exact path first (supports extensionless files).
      try {
        await fileViewerStore.openFile(
          this.db,
          resolved,
          orchestratorStore.activeGroupId,
        );

        return;
      } catch (err) {
        const isNotFound =
          err instanceof DOMException && err.name === "NotFoundError";
        const isDirectory =
          err instanceof DOMException && err.name === "TypeMismatchError";
        if (!isNotFound && !isDirectory) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to open linked file: ${message}`, 5000);

          return;
        }
      }

      await this.openFolderInFilesView(resolved);

      return;
    }

    try {
      await fileViewerStore.openFile(
        this.db,
        resolved,
        orchestratorStore.activeGroupId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to open linked file: ${message}`, 5000);
    }
  }

  async renderPreview(
    content: HTMLElement,
    file: any,
    renderToken: number = this.viewRenderToken,
  ) {
    if (!this.isRenderTokenCurrent(renderToken)) {
      return;
    }

    this.revokeObjectUrl();
    this.previewFrameWindow = null;

    if (file.kind === "pdf") {
      content.classList.remove(
        "file-content--raw",
        "file-content--preview",
        "file-content--iframe",
      );

      const pdfViewer = document.createElement(
        "shadow-claw-pdf-viewer",
      ) as HTMLElement & {
        file: any;
      };
      pdfViewer.file = file;
      content.replaceChildren(pdfViewer);

      return;
    }

    if (file.kind === "binary") {
      this.renderBinaryPreview(content, file);

      return;
    }

    if (this.isIframePreviewFile(file.name)) {
      content.classList.remove("file-content--raw", "file-content--preview");
      content.classList.add("file-content--iframe");

      const iframe = document.createElement("iframe");
      iframe.className = "file-content-iframe";
      iframe.setAttribute("title", `Preview: ${file.name}`);
      iframe.setAttribute(
        "sandbox",
        this.getIframeSandboxPermissions(file.name),
      );

      iframe.setAttribute("referrerpolicy", "no-referrer");
      setTrustedSrcdoc(iframe, await this.buildIframePreviewSrcdoc(file));
      iframe.addEventListener("load", () => {
        this.previewFrameWindow = iframe.contentWindow;
      });

      content.replaceChildren(iframe);

      return;
    }

    content.classList.remove("file-content--raw");
    content.classList.add("file-content--preview");

    const previewHtml = await renderMarkdown(this.toPreviewMarkdown(file));
    if (!this.isRenderTokenCurrent(renderToken)) {
      return;
    }

    const currentFile = fileViewerStore.file;
    const basePath = currentFile?.path || currentFile?.name || "";
    const resolvedPreviewHtml = this.rewriteWorkspacePreviewHtml(
      previewHtml,
      basePath,
    );

    if (!this.isRenderTokenCurrent(renderToken)) {
      return;
    }

    setSanitizedHtml(content, resolvedPreviewHtml, previewSanitizeOptions);
    this.wrapCodeLines(content);
    await this.resolveMarkdownImages(content, basePath);
  }

  async requestCloseViewer(): Promise<boolean> {
    if (!(await this.canDismissViewer())) {
      return false;
    }

    await this.exitFullscreenIfActive();

    fileViewerStore.closeFile();

    return true;
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

    return false;
  }

  async requestNativeFullscreen(target: HTMLElement): Promise<void> {
    const request =
      (target as any).requestFullscreen ||
      (target as any).webkitRequestFullscreen;
    if (typeof request !== "function") {
      throw new Error("Native fullscreen unavailable");
    }

    await Promise.resolve(request.call(target));
  }

  /**
   * Resolves relative image src attributes in rendered markdown by loading the
   * corresponding files from OPFS and replacing the src with an object URL.
   */
  async resolveMarkdownImages(content: HTMLElement, filePath: string) {
    if (!this.db) {
      return;
    }

    const images = Array.from(content.querySelectorAll("img"));
    if (images.length === 0) {
      return;
    }

    await Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute("src") || "";
        if (!src || /^(?:blob:|data:|#)/u.test(src)) {
          return;
        }

        const routeTarget = this.getWorkspaceRouteTarget(src, {
          allowCrossGroup: true,
        });
        const target =
          routeTarget ||
          (() => {
            const path = this.resolveWorkspaceLinkPath(src, filePath);
            if (!path) {
              return null;
            }

            return {
              groupId: orchestratorStore.activeGroupId,
              path,
            };
          })();

        if (!target) {
          return;
        }

        try {
          const bytes = await readGroupFileBytes(
            this.db!,
            target.groupId,
            target.path,
          );
          const ext = target.path.split(".").pop()?.toLowerCase() || "";
          const mimeType = this.mimeTypeForImageExt(ext);

          const blobBytes = new Uint8Array(bytes.byteLength);
          blobBytes.set(bytes);

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(new Blob([blobBytes], { type: mimeType }));
          });

          img.src = dataUrl;
        } catch {
          // File not found or unreadable — leave src as-is.
        }
      }),
    );
  }

  async resolveRelativeImagesInHtml(html: string, filePath: string) {
    if (!this.db || !html) {
      return html;
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    const images = Array.from(parsed.querySelectorAll("img"));
    if (images.length === 0) {
      return html;
    }

    await Promise.all(
      images.map(async (img) => {
        const src = img.getAttribute("src") || "";
        if (!src || /^(?:blob:|data:|#)/u.test(src)) {
          return;
        }

        const routeTarget = this.getWorkspaceRouteTarget(src, {
          allowCrossGroup: true,
        });
        const target =
          routeTarget ||
          (() => {
            const path = this.resolveWorkspaceLinkPath(src, filePath);
            if (!path) {
              return null;
            }

            return {
              groupId: orchestratorStore.activeGroupId,
              path,
            };
          })();

        if (!target) {
          return;
        }

        try {
          const bytes = await readGroupFileBytes(
            this.db!,
            target.groupId,
            target.path,
          );
          const ext = target.path.split(".").pop()?.toLowerCase() || "";
          const mimeType = this.mimeTypeForImageExt(ext);

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

  async toggleFullscreenMode(modal: Element) {
    const fullscreenTarget = this.getFullscreenTarget(modal);
    if (!fullscreenTarget) {
      return;
    }

    if (this.canUseNativeFullscreen(fullscreenTarget)) {
      const isAlreadyFullscreen = this.isTargetInFullscreen(fullscreenTarget);

      try {
        if (isAlreadyFullscreen) {
          await this.exitNativeFullscreen();
          this.isFullscreenMode = false;
        } else {
          await this.requestNativeFullscreen(fullscreenTarget);
          this.isFullscreenMode = true;
        }
      } catch {
        // If native fullscreen fails (permission/user gesture), keep fallback UX.
        this.isFullscreenMode = !this.isFullscreenMode;
      }

      this.applyFullscreenMode(modal);

      return;
    }

    this.isFullscreenMode = !this.isFullscreenMode;
    this.applyFullscreenMode(modal);
  }

  async updateView(renderToken: number = this.viewRenderToken) {
    const file = fileViewerStore.file;
    const root = this.shadowRoot;
    if (!root || !file) {
      return;
    }

    const modal = root.querySelector(".file-modal");
    if (!(modal instanceof HTMLElement)) {
      return;
    }

    this.applyFullscreenMode(modal);

    const content = modal.querySelector(".file-content");
    const previewBtn = modal.querySelector(".modal-preview-btn");
    const modalBody = modal.querySelector(".modal-body");

    if (!(content instanceof HTMLElement)) {
      return;
    }

    content.classList.remove("file-content--iframe");

    const workingFile = this.getWorkingSourceFile(file, modal);
    const canEdit = file.kind === "text";

    if (previewBtn instanceof HTMLButtonElement) {
      previewBtn.setAttribute("aria-pressed", String(this.isFilePreviewMode));
      previewBtn.setAttribute(
        "aria-label",
        this.isFilePreviewMode
          ? "Switch to raw text view"
          : "Switch to preview mode",
      );
    }

    // Get editor elements
    const editorContainer = modal.querySelector(".file-editor-container");
    const editBtn = modal.querySelector(".modal-edit-btn");
    const saveBtn = modal.querySelector(".modal-save-btn");
    const shareBtn = modal.querySelector(".modal-share-btn");
    const closeBtn = modal.querySelector(".modal-close-btn");
    const cancelBtn = modal.querySelector(".modal-cancel-btn");

    if (shareBtn instanceof HTMLButtonElement) {
      const canShare = this.canShareCurrentFile(file);
      shareBtn.classList.toggle("hidden", !canShare);
      shareBtn.disabled = !canShare;
    }

    if (closeBtn instanceof HTMLButtonElement) {
      const isDirty = this.hasUnsavedChanges();
      closeBtn.disabled = false;
      closeBtn.setAttribute(
        "aria-label",
        isDirty ? "Close file viewer (unsaved changes)" : "Close file viewer",
      );
      closeBtn.title = isDirty ? "Close (you have unsaved changes)" : "Close";
    }

    // Save and Cancel are driven purely by dirty state, independent of view mode.
    const isDirty = this.hasUnsavedChanges();
    if (saveBtn instanceof HTMLButtonElement) {
      saveBtn.classList.toggle("hidden", !isDirty);
    }

    if (cancelBtn instanceof HTMLButtonElement) {
      cancelBtn.classList.toggle("hidden", !isDirty);
    }

    if (this.isFilePreviewMode) {
      modalBody?.classList.remove("modal-body--editing");

      content.classList.remove("hidden");
      editorContainer?.classList.remove("active");

      if (editBtn instanceof HTMLButtonElement) {
        editBtn.setAttribute("aria-pressed", "false");
        editBtn.setAttribute("aria-label", "Edit file");
        editBtn.classList.toggle("hidden", !canEdit);
      }

      await this.renderPreview(content, workingFile, renderToken);

      return;
    }

    if (!this.isRenderTokenCurrent(renderToken)) {
      return;
    }

    if (this.isFileEditMode && canEdit) {
      modalBody?.classList.add("modal-body--editing");

      content.classList.add("hidden");
      editorContainer?.classList.add("active");

      if (editBtn instanceof HTMLButtonElement) {
        editBtn.setAttribute("aria-pressed", "true");
        editBtn.setAttribute("aria-label", "Switch to raw text view");
        editBtn.classList.remove("hidden");
      }

      const editor = editorContainer?.querySelector(".file-editor");
      if (editor instanceof HTMLTextAreaElement) {
        editor.setAttribute("tab-size", "2");

        const language = this.getLanguageFromFilename(file.name);
        if (language) {
          editor.setAttribute("language", language);
        } else {
          editor.removeAttribute("language");
        }

        if (!this.isEditorDirty) {
          const targetValue = file.content || "";
          if (editor.value !== targetValue) {
            editor.value = targetValue;
          }

          this.updateEditorHighlight(editor.value);
        } else if (typeof workingFile?.content === "string") {
          if (editor.value !== workingFile.content) {
            editor.value = workingFile.content;
          }

          this.updateEditorHighlight(editor.value);
        }

        editor.dispatchEvent(new Event("scroll"));
      }
    } else {
      modalBody?.classList.remove("modal-body--editing");

      content.classList.remove("hidden");
      editorContainer?.classList.remove("active");

      if (editBtn instanceof HTMLButtonElement) {
        editBtn.setAttribute("aria-pressed", "false");
        editBtn.setAttribute("aria-label", "Edit file");
        editBtn.classList.toggle("hidden", !canEdit);
      }

      content.classList.add("file-content--raw");
      content.classList.remove("file-content--preview", "file-content--iframe");

      if (file.kind === "binary") {
        content.textContent = `Binary file (${file.mimeType || "application/octet-stream"}). Switch to Preview to view.`;
      } else {
        content.textContent = workingFile.content || "";
      }
    }
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawFileViewer);
}
