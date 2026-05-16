import HighlightedCode from "highlighted-code";

import { effect } from "../../effect.js";
import { renderMarkdown } from "../../markdown.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { writeGroupFile } from "../../storage/writeGroupFile.js";
import { showError, showSuccess } from "../../toast.js";

import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-pdf-viewer/shadow-claw-pdf-viewer.js";
import type { ShadowClawDatabase } from "../../types.js";
import { getDb } from "../../db/db.js";

import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-file-viewer";

/**
 * ShadowClawFileViewer - component for viewing and editing files
 */
export class ShadowClawFileViewer extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawFileViewer.componentPath}/${elementName}.css`;
  static template = `${ShadowClawFileViewer.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;

  isFilePreviewMode: boolean = false;
  isFileEditMode: boolean = false;
  isEditorDirty: boolean = false;
  editorDraftContent: string | null = null;

  lastOpenedFileName: string = "";
  viewRenderToken: number = 0;
  currentObjectUrl: string | null = null;
  previewFrameWindow: Window | null = null;

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

    // Ensure highlighted-code theme is initialized once.
    HighlightedCode.useTheme("atom-one-dark");

    // Apply highlight.js theme to markdown preview output in this shadow root.
    const hjsCss = await fetch(
      "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css",
    ).then((r) => r.text());

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(hjsCss);

    // Override highlight.js theme font so it matches our mono font.
    const fontSheet = new CSSStyleSheet();
    fontSheet.replaceSync(
      `pre code.hljs, code.hljs, .hljs { font-family: var(--shadow-claw-font-mono) !important; }`,
    );

    if (this.shadowRoot?.adoptedStyleSheets) {
      this.shadowRoot.adoptedStyleSheets.push(sheet, fontSheet);
    }

    window.addEventListener("message", this.handleIframeMessage);

    this.setupEffects();
    this.bindEventListeners();
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.handleIframeMessage);
    this.revokeObjectUrl();
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

    const current = fileViewerStore.file;
    const basePath = current?.path || current?.name || "";
    void this.openWorkspaceLink(payload.href, basePath);
  };

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modal = root.querySelector(".file-modal");
    modal?.addEventListener("cancel", (event: Event) => {
      if (!this.canDismissViewer()) {
        event.preventDefault();
      }
    });
    modal?.addEventListener("close", () => {
      if (fileViewerStore.file && this.canDismissViewer()) {
        fileViewerStore.closeFile();
      }
    });

    const closeBtn = root.querySelector(".modal-close-btn");
    closeBtn?.addEventListener("click", () => this.requestCloseViewer());

    const previewBtn = root.querySelector(".modal-preview-btn");
    previewBtn?.addEventListener("click", async () => {
      this.isFilePreviewMode = !this.isFilePreviewMode;
      this.isFileEditMode = false;
      await this.updateView();
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

    const modalBody = root.querySelector(".modal-body");

    const cancelBtn = root.querySelector(".modal-cancel-btn");
    cancelBtn?.addEventListener("click", async () => {
      this.isEditorDirty = false;
      this.editorDraftContent = null;
      this.isFileEditMode = false;
      await this.updateView();
    });
    modalBody?.addEventListener("click", (event: Event) => {
      if (event instanceof MouseEvent) {
        void this.handlePreviewLinkClick(event);
      }
    });

    const editor = root.querySelector(".file-editor");
    editor?.addEventListener("input", () => {
      if (editor instanceof HTMLTextAreaElement) {
        this.editorDraftContent = editor.value;
      }

      this.isEditorDirty = true;
      void this.updateView();
    });

    if (editor instanceof HTMLTextAreaElement) {
      const syncHighlight = () => {
        editor.dispatchEvent(new Event("scroll"));
      };

      editor.addEventListener("focus", syncHighlight);
      editor.addEventListener("click", syncHighlight);
      editor.addEventListener("keyup", syncHighlight);
      editor.addEventListener("mouseup", syncHighlight);

      const scrollBody = root.querySelector(".modal-body");
      scrollBody?.addEventListener("scroll", syncHighlight);
    }
  }

  hasUnsavedChanges() {
    return this.isEditorDirty;
  }

  canDismissViewer() {
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    const confirmed = window.confirm(
      "You have unsaved changes. Discard them and close?",
    );
    if (confirmed) {
      this.isEditorDirty = false;
      this.editorDraftContent = null;
    }

    return confirmed;
  }

  requestCloseViewer() {
    if (!this.canDismissViewer()) {
      return;
    }

    fileViewerStore.closeFile();
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
    const resolved = this.resolveWorkspaceLinkPath(href, basePath);

    if (!resolved) {
      const trimmed = href.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("javascript:")) {
        try {
          const parsed = new URL(trimmed, window.location.href);
          const isExternal = parsed.host !== window.location.host;
          if (isExternal) {
            event.preventDefault();
            window.open(trimmed, "_blank", "noopener,noreferrer");
          }
        } catch {
          if (/^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(trimmed)) {
            event.preventDefault();
            window.open(trimmed, "_blank", "noopener,noreferrer");
          }
        }
      }

      return;
    }

    event.preventDefault();
    await this.openWorkspaceLink(href, basePath);
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

  isRenderTokenCurrent(renderToken: number) {
    return this.viewRenderToken === renderToken;
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
          editor.value = file.content || "";
        } else if (typeof workingFile?.content === "string") {
          editor.value = workingFile.content;
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
      iframe.srcdoc = this.buildIframePreviewSrcdoc(file);
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

    content.innerHTML = previewHtml;
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

  getPreviewSourceFile(file: any, modal: HTMLElement) {
    return this.getWorkingSourceFile(file, modal);
  }

  renderBinaryPreview(content: HTMLElement, file: any) {
    const bytes = file.binaryContent;
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      content.classList.remove("file-content--raw", "file-content--iframe");
      content.classList.add("file-content--preview");
      content.textContent = "Binary content unavailable.";

      return;
    }

    const mimeType = file.mimeType || "application/octet-stream";
    // Copy into a plain ArrayBuffer-backed view so BlobPart typing is stable in checkJs.
    const blobBytes = new Uint8Array(bytes.byteLength);
    blobBytes.set(bytes);

    const blob = new Blob([blobBytes], { type: mimeType });
    this.currentObjectUrl = URL.createObjectURL(blob);

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

  revokeObjectUrl() {
    this.previewFrameWindow = null;

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
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

  isWebShareAvailable() {
    return (
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }

  buildWebShareFile(file: any): File | null {
    const bytes = file?.binaryContent;
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
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

  isIframePreviewFile(fileName: string) {
    return /\.(?:html?|svg)$/i.test(fileName);
  }

  getIframeSandboxPermissions(fileName: string) {
    if (/\.svg$/i.test(fileName)) {
      return "allow-modals allow-popups allow-popups-to-escape-sandbox";
    }

    return "allow-modals allow-scripts allow-popups allow-popups-to-escape-sandbox";
  }

  buildIframePreviewSrcdoc(file: any) {
    if (/\.svg$/i.test(file.name)) {
      return file.content;
    }

    const linkBridgeScript =
      "<script>(function(){" +
      "document.addEventListener('click',function(e){" +
      "var t=e.target;if(!(t instanceof Element))return;" +
      "var a=t.closest('a');if(!(a instanceof HTMLAnchorElement))return;" +
      "if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;" +
      "var href=a.getAttribute('href')||'';if(!href)return;" +
      "if(href.startsWith('#')||href.startsWith('javascript:'))return;" +
      "var isExt=false;try{var u=new URL(href,window.location.href);if(u.protocol==='http:'||u.protocol==='https:'){isExt=true;}}catch(err){isExt=true;}" +
      "if(isExt)return;" +
      "e.preventDefault();" +
      "window.parent.postMessage({type:'shadow-claw-file-viewer-link',href:href},'*');" +
      "});" +
      "})();<\/script>";

    return (
      "<!doctype html>" +
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<base target="_blank">' +
      linkBridgeScript +
      "</head><body>" +
      file.content +
      "</body></html>"
    );
  }

  toPreviewMarkdown(file: any) {
    if (this.isMarkdownLikeFile(file.name)) {
      return file.content;
    }

    const lang = this.getLanguageFromFilename(file.name);

    return "```" + lang + "\n" + file.content + "\n```";
  }

  isMarkdownLikeFile(fileName: string) {
    return /(?:^readme$|\.mdx?$|\.markdown$|\.mdown$)/i.test(fileName);
  }

  getLanguageFromFilename(fileName: string) {
    const extension = fileName.toLowerCase().split(".").pop() || "";
    const languageMap: Record<string, string> = {
      bash: "bash",
      cjs: "javascript",
      css: "css",
      html: "html",
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
}

customElements.define(elementName, ShadowClawFileViewer);
