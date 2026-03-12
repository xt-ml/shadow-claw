// @ts-ignore
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

// Keep worker source aligned with the import map pdfjs-dist version in index.html.
GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs";

/**
 * @typedef {Object} PdfFile
 * @property {string} name
 * @property {Uint8Array|null} binaryContent
 */

export class ShadowClawPdfViewer extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });

    /** @type {PdfFile|null} */
    this._file = null;
    /** @type {any|null} */
    this._pdfDocument = null;
    /** @type {any|null} */
    this._loadingTask = null;
    /** @type {any|null} */
    this._renderTask = null;
    /** @type {number} */
    this._pageNumber = 1;
    /** @type {number} */
    this._scale = 1;
    /** @type {number} */
    this._renderVersion = 0;
    /** @type {ResizeObserver|null} */
    this._resizeObserver = null;
    /** @type {ReturnType<typeof globalThis.setTimeout>|null} */
    this._resizeTimer = null;
  }

  static getTemplate() {
    return `
      <style>
        /* Utility classes refactored from inline styles */
        .hidden, [hidden] {
          display: none !important;
        }

        :host {
          display: block;
          height: 100%;
          min-height: 0;
          width: 100%;
        }

        .pdf-viewer {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          height: 100%;
          min-height: 0;
        }

        .pdf-controls {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          row-gap: 0.375rem;
        }

        .pdf-btn {
          background-color: var(--shadow-claw-bg-tertiary, #e2e8f0);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e2e8f0);
          border-radius: var(--shadow-claw-radius-m, 0.75rem);
          color: var(--shadow-claw-text-secondary, #475569);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          min-height: 2rem;
          padding: 0.375rem 0.625rem;
        }

        .pdf-btn:hover,
        .pdf-btn:focus-visible {
          background-color: var(--shadow-claw-bg-secondary, #f1f5f9);
          border-color: var(--shadow-claw-accent-primary, #334155);
          color: var(--shadow-claw-text-primary, #0f172a);
          outline: none;
        }

        .pdf-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .pdf-page,
        .pdf-status {
          color: var(--shadow-claw-text-secondary, #475569);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .pdf-canvas-wrap {
          background-color: var(--shadow-claw-bg-secondary, #f1f5f9);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e2e8f0);
          border-radius: var(--shadow-claw-radius-m, 0.75rem);
          flex: 1;
          min-height: 12rem;
          overflow: auto;
          padding: 0.375rem;
        }

        canvas {
          display: block;
          margin: 0 auto;
          max-width: 100%;
        }

        @media (max-width: 31.25rem) {
          .pdf-controls {
            gap: 0.375rem;
          }

          .pdf-btn {
            font-size: 0.6875rem;
            min-height: 1.875rem;
            padding: 0.3125rem 0.5rem;
          }

          .pdf-page,
          .pdf-status {
            font-size: 0.6875rem;
          }

          .pdf-page {
            flex-basis: 100%;
            order: 10;
          }
        }
      </style>
      <section class="pdf-viewer" aria-label="PDF preview">
        <div class="pdf-controls">
          <button type="button" class="pdf-btn pdf-prev" aria-label="Previous PDF page">◀ Prev</button>
          <span class="pdf-page" aria-live="polite">Page 1 of 1</span>
          <button type="button" class="pdf-btn pdf-next" aria-label="Next PDF page">Next ▶</button>
          <button type="button" class="pdf-btn pdf-zoom-out" aria-label="Zoom out PDF">−</button>
          <button type="button" class="pdf-btn pdf-zoom-in" aria-label="Zoom in PDF">+</button>
          <span class="pdf-status" aria-live="polite"></span>
        </div>
        <div class="pdf-canvas-wrap">
          <canvas class="pdf-canvas"></canvas>
        </div>
      </section>
    `;
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
    this.setupResizeHandling();
    this.loadPdf();
  }

  disconnectedCallback() {
    this.cleanupResizeHandling();
    this.cleanupPdf();
  }

  /**
   * @param {PdfFile|null} value
   */
  set file(value) {
    this._file = value;
    this._pageNumber = 1;
    this._scale = 1;

    this.loadPdf();
  }

  get file() {
    return this._file;
  }

  render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = ShadowClawPdfViewer.getTemplate();

    root.replaceChildren(template.content.cloneNode(true));
  }

  bindEvents() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const prevBtn = root.querySelector(".pdf-prev");
    const nextBtn = root.querySelector(".pdf-next");
    const zoomOutBtn = root.querySelector(".pdf-zoom-out");
    const zoomInBtn = root.querySelector(".pdf-zoom-in");

    prevBtn?.addEventListener("click", async () => {
      if (!this._pdfDocument || this._pageNumber <= 1) {
        return;
      }

      this._pageNumber -= 1;
      await this.renderCurrentPage();
    });

    nextBtn?.addEventListener("click", async () => {
      if (
        !this._pdfDocument ||
        this._pageNumber >= this._pdfDocument.numPages
      ) {
        return;
      }

      this._pageNumber += 1;
      await this.renderCurrentPage();
    });

    zoomOutBtn?.addEventListener("click", async () => {
      this._scale = Math.max(0.5, this._scale - 0.2);
      await this.renderCurrentPage();
    });

    zoomInBtn?.addEventListener("click", async () => {
      this._scale = Math.min(4, this._scale + 0.2);
      await this.renderCurrentPage();
    });
  }

  async loadPdf() {
    const root = this.shadowRoot;
    if (!root || !this.isConnected) {
      return;
    }

    const sourceData = this._file?.binaryContent;
    if (!(sourceData instanceof Uint8Array) || sourceData.length === 0) {
      this.setStatus("PDF data unavailable.");
      this.updateControls();

      return;
    }

    // PDF.js may transfer/consume the provided ArrayBuffer in worker mode.
    // Clone bytes so toggling preview/raw can reopen the same in-memory file.
    const data = sourceData.slice();

    this.cleanupPdf();

    try {
      this.setStatus("Loading PDF...");

      this._loadingTask = getDocument({ data });
      this._pdfDocument = await this._loadingTask.promise;
      this._pageNumber = 1;

      await this.renderCurrentPage();

      this.setStatus("");
    } catch (err) {
      this.setStatus("Failed to render PDF preview.");

      console.error("PDF preview error", err);
    }
  }

  async renderCurrentPage() {
    if (!this._pdfDocument) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const canvas = root.querySelector(".pdf-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const renderVersion = ++this._renderVersion;

    try {
      this.setStatus("Rendering page...");

      const page = await this._pdfDocument.getPage(this._pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = this.getRenderScale(baseViewport.width);
      const viewport = page.getViewport({ scale });
      const dpr = globalThis.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const context = canvas.getContext("2d");
      if (!context) {
        this.setStatus("Unable to render PDF canvas.");
        return;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (this._renderTask) {
        this._renderTask.cancel();
      }

      this._renderTask = page.render({ canvasContext: context, viewport });
      await this._renderTask.promise;

      if (renderVersion !== this._renderVersion) {
        return;
      }

      this.setStatus("");
      this.updateControls();
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        err.name === "RenderingCancelledException"
      ) {
        return;
      }

      this.setStatus("Failed to render PDF page.");
      console.error("PDF page render error", err);
    }
  }

  /**
   * @param {number} pageWidthAtScale1
   *
   * @returns {number}
   */
  getRenderScale(pageWidthAtScale1) {
    const root = this.shadowRoot;
    const wrap = root?.querySelector(".pdf-canvas-wrap");

    if (!(wrap instanceof HTMLElement) || pageWidthAtScale1 <= 0) {
      return this._scale;
    }

    const styles = globalThis.getComputedStyle(wrap);
    const padLeft = parseFloat(styles.paddingLeft) || 0;
    const padRight = parseFloat(styles.paddingRight) || 0;
    const availableWidth = Math.max(1, wrap.clientWidth - padLeft - padRight);
    const fitScale = availableWidth / pageWidthAtScale1;

    return Math.max(0.25, fitScale * this._scale);
  }

  setupResizeHandling() {
    const root = this.shadowRoot;
    const wrap = root?.querySelector(".pdf-canvas-wrap");

    if (!(wrap instanceof HTMLElement)) {
      return;
    }

    if ("ResizeObserver" in globalThis) {
      this._resizeObserver = new ResizeObserver(() => {
        if (this._resizeTimer !== null) {
          clearTimeout(this._resizeTimer);
        }

        this._resizeTimer = globalThis.setTimeout(() => {
          this._resizeTimer = null;

          if (!this._pdfDocument) {
            return;
          }

          this.renderCurrentPage().catch((err) => {
            console.error("PDF resize re-render error", err);
          });
        }, 100);
      });

      this._resizeObserver.observe(wrap);
    }
  }

  cleanupResizeHandling() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._resizeTimer !== null) {
      clearTimeout(this._resizeTimer);

      this._resizeTimer = null;
    }
  }

  updateControls() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const prevBtn = root.querySelector(".pdf-prev");
    const nextBtn = root.querySelector(".pdf-next");
    const page = root.querySelector(".pdf-page");

    const totalPages = this._pdfDocument?.numPages || 1;

    if (page) {
      page.textContent = `Page ${this._pageNumber} of ${totalPages} (${Math.round(this._scale * 100)}%)`;
    }

    if (prevBtn instanceof HTMLButtonElement) {
      prevBtn.disabled = !this._pdfDocument || this._pageNumber <= 1;
    }

    if (nextBtn instanceof HTMLButtonElement) {
      nextBtn.disabled = !this._pdfDocument || this._pageNumber >= totalPages;
    }
  }

  /**
   * @param {string} message
   */
  setStatus(message) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const status = root.querySelector(".pdf-status");
    if (status) {
      status.textContent = message;
    }
  }

  cleanupPdf() {
    if (this._renderTask) {
      this._renderTask.cancel();
      this._renderTask = null;
    }

    if (this._loadingTask) {
      this._loadingTask.destroy();
      this._loadingTask = null;
    }

    if (this._pdfDocument) {
      this._pdfDocument.destroy();
      this._pdfDocument = null;
    }
  }
}

customElements.define("shadow-claw-pdf-viewer", ShadowClawPdfViewer);
