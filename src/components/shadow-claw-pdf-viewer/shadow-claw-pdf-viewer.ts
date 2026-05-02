import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

import ShadowClawElement from "../shadow-claw-element.js";

/**
 * pdf.js 5.x may call Map/WeakMap#getOrInsertComputed in some builds.
 * Safari versions without that proposal need a tiny shim.
 */
function installGetOrInsertComputedPolyfill() {
  const install = (proto) => {
    if (!proto || typeof proto.getOrInsertComputed === "function") {
      return;
    }

    Object.defineProperty(proto, "getOrInsertComputed", {
      configurable: true,
      writable: true,
      value(key, compute) {
        if (this.has(key)) {
          return this.get(key);
        }

        const value = compute();
        this.set(key, value);

        return value;
      },
    });
  };

  install(Map.prototype);
  install(WeakMap.prototype);
}

installGetOrInsertComputedPolyfill();

// Keep worker source aligned with the local bundled worker.
GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

export interface PdfFile {
  name: string;
  binaryContent: Uint8Array | null;
}

const elementName = "shadow-claw-pdf-viewer";

export class ShadowClawPdfViewer extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawPdfViewer.componentPath}/${elementName}.css`;
  static template = `${ShadowClawPdfViewer.componentPath}/${elementName}.html`;

  _file: PdfFile | null = null;
  _loadingTask: any | null = null;
  _pageNumber: number = 1;
  _pdfDocument: any | null = null;
  _renderTask: any | null = null;
  _renderVersion: number = 0;
  _resizeObserver: ResizeObserver | null = null;
  _resizeTimer: any | null = null;
  _scale: number = 1;
  _isPanning: boolean = false;
  _panStartX: number = 0;
  _panStartY: number = 0;
  _panStartScrollLeft: number = 0;
  _panStartScrollTop: number = 0;

  _handlePanMoveRef: (event: MouseEvent | TouchEvent) => void;
  _handlePanEndRef: () => void;

  constructor() {
    super();

    this._handlePanMoveRef = (event: MouseEvent | TouchEvent) => {
      this.handlePanMove(event);
    };
    this._handlePanEndRef = () => {
      this.stopPanning();
    };
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.bindEvents();

    this.setupResizeHandling();
    this.loadPdf();
  }

  disconnectedCallback() {
    this.stopPanning();
    this.cleanupResizeHandling();
    this.cleanupPdf();
  }

  set file(value: PdfFile | null) {
    this._file = value;
    this._pageNumber = 1;
    this._scale = 1;

    this.loadPdf();
  }

  get file() {
    return this._file;
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
    const wrap = root.querySelector(".pdf-canvas-wrap");

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

    if (wrap instanceof HTMLElement) {
      wrap.addEventListener("mousedown", (event) => this.handlePanStart(event));
      wrap.addEventListener(
        "touchstart",
        (event) => this.handlePanStart(event),
        {
          passive: false,
        },
      );
    }
  }

  handlePanStart(event: MouseEvent | TouchEvent) {
    if (!this._pdfDocument) {
      return;
    }

    const root = this.shadowRoot;
    const wrap = root?.querySelector(".pdf-canvas-wrap");
    if (!(wrap instanceof HTMLElement)) {
      return;
    }

    const point = this.getEventPoint(event);
    if (!point) {
      return;
    }

    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    }

    this._isPanning = true;
    this._panStartX = point.x;
    this._panStartY = point.y;
    this._panStartScrollLeft = wrap.scrollLeft;
    this._panStartScrollTop = wrap.scrollTop;

    wrap.classList.add("is-panning");

    globalThis.addEventListener("mousemove", this._handlePanMoveRef);
    globalThis.addEventListener("mouseup", this._handlePanEndRef);
    globalThis.addEventListener("touchmove", this._handlePanMoveRef, {
      passive: false,
    });
    globalThis.addEventListener("touchend", this._handlePanEndRef);
    globalThis.addEventListener("touchcancel", this._handlePanEndRef);

    event.preventDefault();
  }

  handlePanMove(event: MouseEvent | TouchEvent) {
    if (!this._isPanning) {
      return;
    }

    const root = this.shadowRoot;
    const wrap = root?.querySelector(".pdf-canvas-wrap");
    if (!(wrap instanceof HTMLElement)) {
      return;
    }

    const point = this.getEventPoint(event);
    if (!point) {
      return;
    }

    const deltaX = point.x - this._panStartX;
    const deltaY = point.y - this._panStartY;

    wrap.scrollLeft = this._panStartScrollLeft - deltaX;
    wrap.scrollTop = this._panStartScrollTop - deltaY;

    event.preventDefault();
  }

  stopPanning() {
    if (!this._isPanning) {
      return;
    }

    this._isPanning = false;

    globalThis.removeEventListener("mousemove", this._handlePanMoveRef);
    globalThis.removeEventListener("mouseup", this._handlePanEndRef);
    globalThis.removeEventListener("touchmove", this._handlePanMoveRef);
    globalThis.removeEventListener("touchend", this._handlePanEndRef);
    globalThis.removeEventListener("touchcancel", this._handlePanEndRef);

    const root = this.shadowRoot;
    const wrap = root?.querySelector(".pdf-canvas-wrap");
    if (wrap instanceof HTMLElement) {
      wrap.classList.remove("is-panning");
    }
  }

  getEventPoint(
    event: MouseEvent | TouchEvent,
  ): { x: number; y: number } | null {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    }

    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) {
      return null;
    }

    return { x: touch.clientX, y: touch.clientY };
  }

  async loadPdf() {
    const root = this.shadowRoot;
    if (!root || !this.isConnected) {
      return;
    }

    const sourceData = this._file?.binaryContent;
    if (!(sourceData instanceof Uint8Array) || sourceData.length === 0) {
      this.stopPanning();
      this.setStatus("PDF data unavailable.");
      this.updateControls();
      this.updatePanState();

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
      this.updatePanState();
    } catch (err) {
      this.stopPanning();
      this.updatePanState();
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

  getRenderScale(pageWidthAtScale1: number): number {
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

    this.updatePanState();
  }

  updatePanState() {
    const root = this.shadowRoot;
    const wrap = root?.querySelector(".pdf-canvas-wrap");
    if (!(wrap instanceof HTMLElement)) {
      return;
    }

    wrap.classList.toggle("is-pannable", !!this._pdfDocument);
  }

  setStatus(message: string) {
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
    this.stopPanning();

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

    this.updatePanState();
  }
}

customElements.define(elementName, ShadowClawPdfViewer);
