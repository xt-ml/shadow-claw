// @ts-ignore
import HighlightedCode from "highlighted-code";

import { effect } from "../effect.mjs";
import { renderMarkdown } from "../markdown.mjs";
import { fileViewerStore } from "../stores/file-viewer.mjs";
import { orchestratorStore } from "../stores/orchestrator.mjs";
import { writeGroupFile } from "../storage/writeGroupFile.mjs";
import { showError, showSuccess } from "../toast.mjs";

import "./shadow-claw-pdf-viewer.mjs";
import "../types.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * ShadowClawFileViewer - component for viewing and editing files
 */
export class ShadowClawFileViewer extends HTMLElement {
  /**
   * @type {ShadowClawDatabase|null}
   */
  db = null;

  /**
   * @type {boolean}
   */
  isFilePreviewMode = false;

  /**
   * @type {boolean}
   */
  isFileEditMode = false;

  /**
   * @type {boolean}
   */
  isEditorDirty = false;

  /**
   * @type {string}
   */
  lastOpenedFileName = "";

  /** @type {string|null} */
  currentObjectUrl = null;

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
  }

  static getTemplate() {
    return `
      <style>
        /* Utility classes refactored from inline styles */
        .hidden, [hidden] {
          display: none !important;
        }

        :host {
          display: contents;
        }

        .file-modal {
          background: transparent;
          border: none;
          max-height: unset;
          max-width: unset;
          margin: 0;
          padding: 0;
        }

        .file-modal[open] {
          align-items: flex-start;
          box-sizing: border-box;
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 0.5rem;
          position: fixed;
          width: auto;
          z-index: 1000;
        }

        .file-modal::backdrop {
          background-color: rgba(0, 0, 0, 0.5);
        }

        .modal-content {
          background-color: var(--shadow-claw-bg-primary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-l);
          box-shadow: var(--shadow-claw-shadow-lg);
          display: flex;
          flex-direction: column;
          height: min(88dvh, 45rem);
          max-height: calc(100dvh - 1rem);
          max-width: 56rem;
          width: calc(100vw - 1rem);
        }

        .modal-header {
          align-items: center;
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
          display: flex;
          gap: 0.5rem;
          justify-content: space-between;
          min-width: 0;
          padding: 0.625rem 0.75rem;
        }

        .modal-header-actions {
          align-items: center;
          flex: none;
          display: flex;
          gap: 0.5rem;
        }

        .modal-edit-btn,
        .modal-save-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-m);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          min-height: 2rem;
          padding: 0.375rem 0.625rem;
        }

        .modal-edit-btn:hover,
        .modal-save-btn:hover {
          background-color: var(--shadow-claw-bg-secondary);
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-text-primary);
        }

        .modal-save-btn {
          background-color: var(--shadow-claw-success-color);
          border-color: var(--shadow-claw-success-color);
          color: white;
        }

        .modal-save-btn:hover {
          background-color: #059669;
          border-color: #059669;
          color: white;
        }

        .modal-title {
          color: var(--shadow-claw-text-primary);
          flex: 1;
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .modal-close-btn,
        .modal-preview-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-m);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.875rem;
          min-height: 2rem;
          padding: 0.375rem 0.625rem;
        }

        .modal-close-btn {
          font-size: 1.25rem;
          line-height: 1;
        }

        .modal-close-btn:hover,
        .modal-preview-btn:hover {
          background-color: var(--shadow-claw-bg-secondary);
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-text-primary);
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 0.75rem;
          position: relative;
        }

        .modal-body.modal-body--editing {
          overflow: hidden;
        }

        .file-content {
          color: var(--shadow-claw-text-primary);
          flex: 1;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          min-height: 0;
          overflow: auto;
          white-space: pre-wrap;
          width: 100%;
          word-break: break-all;
        }

        .file-content--preview {
          font-family: var(--shadow-claw-font-sans);
          font-size: 0.875rem;
          padding: 0.5rem;
          white-space: normal;
          word-break: normal;
        }

        .file-content--iframe {
          height: 100%;
          margin: 0;
          overflow: hidden;
          padding: 0;
          width: 100%;
        }

        .file-content-iframe {
          background-color: white;
          border-radius: var(--shadow-claw-radius-s);
          border: none;
          height: 100%;
          width: 100%;
        }

        .file-editor-container {
          display: none;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          position: relative;
        }

        .file-editor-container.active {
          display: flex;
        }

        .file-editor {
          background-color: var(--shadow-claw-bg-primary);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          border-radius: var(--shadow-claw-radius-s);
          color: var(--shadow-claw-text-primary);
          flex: 1;
          font-family: var(--shadow-claw-font-mono) !important;
          font-size: 0.8125rem !important;
          line-height: 1.5 !important;
          min-height: 0;
          overflow: auto;
          padding: 0.625rem;
          resize: none;
          tab-size: 2;
          white-space: pre;
        }

        .file-editor-container pre.highlighted-code {
          border-radius: var(--shadow-claw-radius-s);
          font-family: var(--shadow-claw-font-mono) !important;
          font-size: 0.8125rem !important;
          left: 0 !important;
          line-height: 1.5 !important;
          margin: 0 !important;
          top: 0 !important;
          white-space: pre !important;
        }

        .file-editor-container pre.highlighted-code code,
        .file-editor-container pre.highlighted-code code.hljs {
          font-family: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          margin: 0 !important;
          padding: 0 !important;
          white-space: inherit !important;
          word-break: normal !important;
          word-wrap: normal !important;
        }

        .file-editor:focus {
          border-color: var(--shadow-claw-accent-primary);
          box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
          outline: none;
        }
      </style>
      <dialog class="file-modal" aria-label="File viewer">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">File: </h3>
            <div class="modal-header-actions">
              <button class="modal-edit-btn" type="button" aria-label="Edit file">✏️ Edit</button>
              <button class="modal-save-btn hidden" type="button" aria-label="Save file">💾 Save</button>
              <button class="modal-preview-btn" type="button" aria-label="Toggle preview mode" aria-pressed="false">👁️ Preview</button>
              <button class="modal-close-btn" type="button" aria-label="Close file viewer">&times;</button>
            </div>
          </div>
          <div class="modal-body">
            <div class="file-content file-content--raw"></div>
            <div class="file-editor-container">
              <textarea
                is="highlighted-code"
                class="file-editor"
                aria-label="File editor"
                spellcheck="false"
              ></textarea>
            </div>
          </div>
        </div>
      </dialog>
    `;
  }

  async connectedCallback() {
    // Ensure highlighted-code theme is initialized once.
    HighlightedCode.useTheme("atom-one-dark");

    // Apply highlight.js theme to markdown preview output in this shadow root.
    const hjsCss = await fetch(
      "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css",
    ).then((r) => r.text());

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(hjsCss);

    if (this.shadowRoot?.adoptedStyleSheets) {
      this.shadowRoot.adoptedStyleSheets.push(sheet);
    }

    this.render();
    this.setupEffects();
    this.bindEventListeners();
  }

  disconnectedCallback() {
    this.revokeObjectUrl();
  }

  /**
   * Initialize the component
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {void}
   */
  initialize(db) {
    this.db = db;
  }

  render() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = ShadowClawFileViewer.getTemplate();
    }
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modal = root.querySelector(".file-modal");
    modal?.addEventListener("close", () => {
      if (fileViewerStore.file) {
        fileViewerStore.closeFile();
      }
    });

    const closeBtn = root.querySelector(".modal-close-btn");
    closeBtn?.addEventListener("click", () => fileViewerStore.closeFile());

    const previewBtn = root.querySelector(".modal-preview-btn");
    previewBtn?.addEventListener("click", () => {
      this.isFilePreviewMode = !this.isFilePreviewMode;
      this.isFileEditMode = false;
      this.isEditorDirty = false;
      this.updateView();
    });

    const editBtn = root.querySelector(".modal-edit-btn");
    editBtn?.addEventListener("click", () => {
      this.isFileEditMode = !this.isFileEditMode;
      if (this.isFileEditMode) {
        this.isFilePreviewMode = false;
        this.isEditorDirty = false;
      }

      this.updateView();
    });

    const saveBtn = root.querySelector(".modal-save-btn");
    saveBtn?.addEventListener("click", () => this.handleSave());

    const editor = root.querySelector(".file-editor");
    editor?.addEventListener("input", () => {
      this.isEditorDirty = true;
    });

    if (editor instanceof HTMLTextAreaElement) {
      const syncHighlight = () => {
        editor.dispatchEvent(new Event("scroll"));
      };

      editor.addEventListener("focus", syncHighlight);
      editor.addEventListener("click", syncHighlight);
      editor.addEventListener("keyup", syncHighlight);
      editor.addEventListener("mouseup", syncHighlight);

      const modalBody = root.querySelector(".modal-body");
      modalBody?.addEventListener("scroll", syncHighlight);
    }
  }

  setupEffects() {
    effect(() => {
      const file = fileViewerStore.file;
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
        }

        this.updateView();
      } else {
        if (modal.open) {
          modal.close();
        }

        this.lastOpenedFileName = "";
        this.isFilePreviewMode = false;
        this.isEditorDirty = false;

        this.resetContent();
      }
    });
  }

  updateView() {
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

    if (previewBtn instanceof HTMLButtonElement) {
      previewBtn.textContent = this.isFilePreviewMode ? "📄 Raw" : "👁️ Preview";
      previewBtn.setAttribute("aria-pressed", String(this.isFilePreviewMode));
      previewBtn.setAttribute(
        "aria-label",
        this.isFilePreviewMode
          ? "Switch to raw text view"
          : "Switch to preview mode",
      );
    }

    if (!(content instanceof HTMLElement)) {
      return;
    }

    content.classList.remove("file-content--iframe");

    // Get editor elements
    const editorContainer = modal.querySelector(".file-editor-container");
    const editBtn = modal.querySelector(".modal-edit-btn");
    const saveBtn = modal.querySelector(".modal-save-btn");

    if (this.isFilePreviewMode) {
      modalBody?.classList.remove("modal-body--editing");

      // Ensure preview is visible and editor is hidden
      content.classList.remove("hidden");
      editorContainer?.classList.remove("active");

      saveBtn?.classList.add("hidden");
      if (editBtn instanceof HTMLButtonElement) {
        editBtn.textContent = "✏️ Edit";
        editBtn.classList.toggle("hidden", file.kind === "pdf");
      }

      this.renderPreview(content, file);

      return;
    }

    if (this.isFileEditMode && file.kind === "text") {
      modalBody?.classList.add("modal-body--editing");

      content.classList.add("hidden");
      editorContainer?.classList.add("active");
      saveBtn?.classList.remove("hidden");

      if (editBtn instanceof HTMLButtonElement) {
        editBtn.textContent = "❌ Cancel";
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
        }

        // Ensure overlay and caret start fully synchronized when entering edit mode.
        editor.dispatchEvent(new Event("scroll"));
      }
    } else {
      modalBody?.classList.remove("modal-body--editing");

      content.classList.remove("hidden");
      editorContainer?.classList.remove("active");
      saveBtn?.classList.add("hidden");

      if (editBtn instanceof HTMLButtonElement) {
        editBtn.textContent = "✏️ Edit";
      }

      content.classList.add("file-content--raw");
      content.classList.remove("file-content--preview", "file-content--iframe");

      if (file.kind === "binary") {
        content.textContent = `Binary file (${file.mimeType || "application/octet-stream"}). Switch to Preview to view.`;
      } else {
        content.textContent = file.content || "";
      }
    }
  }

  /**
   * @param {HTMLElement} content
   *
   * @param {any} file
   */
  renderPreview(content, file) {
    this.revokeObjectUrl();

    if (file.kind === "pdf") {
      content.classList.remove(
        "file-content--raw",
        "file-content--preview",
        "file-content--iframe",
      );

      const pdfViewer = document.createElement("shadow-claw-pdf-viewer");
      // @ts-ignore
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

      content.replaceChildren(iframe);

      return;
    }

    content.classList.remove("file-content--raw");
    content.classList.add("file-content--preview");
    content.innerHTML = renderMarkdown(this.toPreviewMarkdown(file));
  }

  /**
   * @param {HTMLElement} content
   * @param {any} file
   */
  renderBinaryPreview(content, file) {
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
      previewBtn.textContent = "👁️ Preview";
      previewBtn.setAttribute("aria-pressed", "false");
      previewBtn.setAttribute("aria-label", "Switch to preview mode");
    }

    const editBtn = modal.querySelector(".modal-edit-btn");
    if (editBtn instanceof HTMLButtonElement) {
      editBtn.textContent = "✏️ Edit";
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
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  /**
   * @param {any} file
   */
  shouldAutoPreview(file) {
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

      this.updateView();
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

  /**
   * @param {string} fileName
   */
  isIframePreviewFile(fileName) {
    return /\.(?:html?|svg)$/i.test(fileName);
  }

  /**
   * @param {string} fileName
   */
  getIframeSandboxPermissions(fileName) {
    if (/\.svg$/i.test(fileName)) {
      return "allow-modals allow-popups allow-popups-to-escape-sandbox";
    }

    return "allow-modals allow-scripts allow-popups allow-popups-to-escape-sandbox";
  }

  /**
   * @param {any} file
   */
  buildIframePreviewSrcdoc(file) {
    if (/\.svg$/i.test(file.name)) {
      return file.content;
    }

    return (
      "<!doctype html>" +
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<base target="_blank">' +
      "</head><body>" +
      file.content +
      "</body></html>"
    );
  }

  /**
   * @param {any} file
   */
  toPreviewMarkdown(file) {
    if (this.isMarkdownLikeFile(file.name)) {
      return file.content;
    }

    const lang = this.getLanguageFromFilename(file.name);
    return "```" + lang + "\n" + file.content + "\n```";
  }

  /**
   * @param {string} fileName
   */
  isMarkdownLikeFile(fileName) {
    return /(?:^readme$|\.mdx?$|\.markdown$|\.mdown$)/i.test(fileName);
  }

  /**
   * @param {string} fileName
   */
  getLanguageFromFilename(fileName) {
    const extension = fileName.toLowerCase().split(".").pop() || "";

    /** @type {Record<string, string>} */
    const languageMap = {
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

customElements.define("shadow-claw-file-viewer", ShadowClawFileViewer);
