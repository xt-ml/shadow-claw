import { jest } from "@jest/globals";

const getDocumentMock = jest.fn();

jest.unstable_mockModule("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: getDocumentMock,
}));

const { ShadowClawPdfViewer } = await import("./shadow-claw-pdf-viewer.js");

describe("shadow-claw-pdf-viewer", () => {
  /* @type any */
  let originalGetContext;

  beforeEach(() => {
    getDocumentMock.mockReset();

    const renderTask: any = {
      promise: Promise.resolve(),
      cancel: jest.fn(),
    };

    const page: any = {
      getViewport: ({ scale }) => ({ width: 200 * scale, height: 300 * scale }),
      render: jest.fn(() => renderTask),
    };

    const pdfDocument: any = {
      numPages: 1,
      getPage: jest.fn(async () => page),
      destroy: jest.fn(),
    };

    (getDocumentMock as any).mockImplementation(() => ({
      promise: Promise.resolve(pdfDocument),
      destroy: jest.fn(),
    }));

    originalGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      setTransform: jest.fn(),
    })) as any;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    document.body.innerHTML = "";
  });

  it("clones binary bytes on each load so reopen works", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    const originalBytes = new Uint8Array([1, 2, 3, 4]);
    const file: any = {
      name: "sample.pdf",
      binaryContent: originalBytes,
    };

    viewer.file = file;
    await Promise.resolve();
    await Promise.resolve();

    viewer.file = file;
    await Promise.resolve();
    await Promise.resolve();

    expect(getDocumentMock).toHaveBeenCalledTimes(2);

    const firstBytes = (getDocumentMock as any).mock.calls[0][0].data;

    const secondBytes = (getDocumentMock as any).mock.calls[1][0].data;

    expect(firstBytes).toBeInstanceOf(Uint8Array);

    expect(secondBytes).toBeInstanceOf(Uint8Array);

    expect(firstBytes).not.toBe(originalBytes);

    expect(secondBytes).not.toBe(originalBytes);

    expect(secondBytes).not.toBe(firstBytes);

    firstBytes[0] = 99;
    expect(originalBytes[0]).toBe(1);
  });

  it("pans the canvas container while dragging", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };

    await Promise.resolve();
    await Promise.resolve();

    const wrap = viewer.shadowRoot?.querySelector(".pdf-canvas-wrap");
    expect(wrap).toBeInstanceOf(HTMLElement);

    const panWrap = wrap as HTMLElement;
    panWrap.scrollLeft = 100;
    panWrap.scrollTop = 120;

    panWrap.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 200,
        clientY: 180,
      }),
    );

    expect(panWrap.classList.contains("is-panning")).toBe(true);

    globalThis.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: 160,
        clientY: 140,
      }),
    );

    expect(panWrap.scrollLeft).toBe(140);
    expect(panWrap.scrollTop).toBe(160);

    globalThis.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(panWrap.classList.contains("is-panning")).toBe(false);
  });

  it("handles pagination and zoom button interactions", async () => {
    const renderTask: any = {
      promise: Promise.resolve(),
      cancel: jest.fn(),
    };
    const page: any = {
      getViewport: ({ scale }: any) => ({
        width: 200 * scale,
        height: 300 * scale,
      }),
      render: jest.fn(() => renderTask),
    };
    const pdfDocument: any = {
      numPages: 3,
      getPage: jest.fn(async () => page),
      destroy: jest.fn(),
    };

    (getDocumentMock as any).mockImplementation(() => ({
      promise: Promise.resolve(pdfDocument),
      destroy: jest.fn(),
    }));

    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };
    await new Promise((r) => setTimeout(r, 50));

    const nextBtn = viewer.shadowRoot?.querySelector(
      ".pdf-next",
    ) as HTMLButtonElement;
    const prevBtn = viewer.shadowRoot?.querySelector(
      ".pdf-prev",
    ) as HTMLButtonElement;
    const zoomInBtn = viewer.shadowRoot?.querySelector(
      ".pdf-zoom-in",
    ) as HTMLButtonElement;
    const zoomOutBtn = viewer.shadowRoot?.querySelector(
      ".pdf-zoom-out",
    ) as HTMLButtonElement;
    const pageInfo = viewer.shadowRoot?.querySelector(".pdf-page");

    expect(viewer._pageNumber).toBe(1);
    expect(pageInfo?.textContent).toContain("Page 1 of 3");

    // Click Next
    nextBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._pageNumber).toBe(2);

    // Click Next again
    nextBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._pageNumber).toBe(3);

    // Clicking Next when at max pages does not exceed max
    nextBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._pageNumber).toBe(3);

    // Click Prev
    prevBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._pageNumber).toBe(2);

    // Click Prev to 1
    prevBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._pageNumber).toBe(1);

    // Clicking Prev at page 1 does not decrement
    prevBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._pageNumber).toBe(1);

    // Zoom in
    const initialScale = viewer._scale;
    zoomInBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._scale).toBeGreaterThan(initialScale);

    // Zoom out
    zoomOutBtn.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 50));
    expect(viewer._scale).toBeCloseTo(initialScale);
  });

  it("handles touch panning", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };
    await Promise.resolve();
    await Promise.resolve();

    const wrap = viewer.shadowRoot?.querySelector(
      ".pdf-canvas-wrap",
    ) as HTMLElement;
    wrap.scrollLeft = 50;
    wrap.scrollTop = 50;

    const touchStartEvent = new CustomEvent("touchstart", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(touchStartEvent, "touches", {
      value: [{ clientX: 100, clientY: 100 }],
    });
    wrap.dispatchEvent(touchStartEvent);

    expect(viewer._isPanning).toBe(true);

    const touchMoveEvent = new CustomEvent("touchmove", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(touchMoveEvent, "touches", {
      value: [{ clientX: 70, clientY: 60 }],
    });
    globalThis.dispatchEvent(touchMoveEvent);

    expect(wrap.scrollLeft).toBe(80);
    expect(wrap.scrollTop).toBe(90);

    const touchEndEvent = new CustomEvent("touchend", {
      bubbles: true,
      cancelable: true,
    });
    globalThis.dispatchEvent(touchEndEvent);

    expect(viewer._isPanning).toBe(false);
  });

  it("handles empty or unavailable PDF data", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "empty.pdf",
      binaryContent: new Uint8Array(0),
    };
    await Promise.resolve();

    const status = viewer.shadowRoot?.querySelector(".pdf-status");
    expect(status?.textContent).toBe("PDF data unavailable.");
  });

  it("handles getDocument rejection during PDF load", async () => {
    (getDocumentMock as any).mockImplementationOnce(() => ({
      promise: Promise.reject(new Error("Corrupt PDF")),
      destroy: jest.fn(),
    }));

    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "corrupt.pdf",
      binaryContent: new Uint8Array([1, 2, 3]),
    };
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const status = viewer.shadowRoot?.querySelector(".pdf-status");
    expect(status?.textContent).toBe("Failed to render PDF preview.");
  });

  it("handles RenderingCancelledException gracefully", async () => {
    const renderTask: any = {
      promise: Promise.reject({ name: "RenderingCancelledException" }),
      cancel: jest.fn(),
    };
    const page: any = {
      getViewport: ({ scale }: any) => ({
        width: 200 * scale,
        height: 300 * scale,
      }),
      render: jest.fn(() => renderTask),
    };
    const pdfDocument: any = {
      numPages: 1,
      getPage: jest.fn(async () => page),
      destroy: jest.fn(),
    };

    (getDocumentMock as any).mockImplementationOnce(() => ({
      promise: Promise.resolve(pdfDocument),
      destroy: jest.fn(),
    }));

    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Should not show error status on cancelled rendering
    const status = viewer.shadowRoot?.querySelector(".pdf-status");
    expect(status?.textContent).not.toBe("Failed to render PDF page.");
  });

  it("cleans up on disconnectedCallback", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };
    await Promise.resolve();
    await Promise.resolve();

    viewer.remove();
    expect(viewer._pdfDocument).toBeNull();
  });

  it("clamps zoom scale to [0.5, 4]", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);
    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };
    await Promise.resolve();
    await Promise.resolve();

    const zoomOutBtn = viewer.shadowRoot?.querySelector(
      ".pdf-zoom-out",
    ) as HTMLButtonElement;
    const zoomInBtn = viewer.shadowRoot?.querySelector(
      ".pdf-zoom-in",
    ) as HTMLButtonElement;

    // Zoom out until clamped at 0.5
    for (let i = 0; i < 10; i++) {
      zoomOutBtn.click();
    }
    await Promise.resolve();
    expect(viewer._scale).toBe(0.5);

    // Zoom in until clamped at 4
    for (let i = 0; i < 25; i++) {
      zoomInBtn.click();
    }
    await Promise.resolve();
    expect(viewer._scale).toBe(4);

    viewer.remove();
  });

  it("handles canvas 2d context null and page render error", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);

    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // 1. canvas.getContext returns null
    (HTMLCanvasElement.prototype.getContext as any) = jest.fn(() => null);
    await viewer.renderCurrentPage();

    let status = viewer.shadowRoot?.querySelector(".pdf-status");
    expect(status?.textContent).toBe("Unable to render PDF canvas.");

    // 2. Page render throws non-cancelled error
    const page: any = {
      getViewport: () => ({ width: 100, height: 100 }),
      render: () => ({
        cancel: jest.fn(),
        promise: Promise.reject(new Error("Render draw failure")),
      }),
    };
    (HTMLCanvasElement.prototype.getContext as any) = jest.fn(() => ({
      setTransform: jest.fn(),
    }));
    viewer._pdfDocument = {
      getPage: jest.fn(async () => page),
      numPages: 1,
      destroy: jest.fn(),
    };
    await viewer.renderCurrentPage();

    status = viewer.shadowRoot?.querySelector(".pdf-status");
    expect(status?.textContent).toBe("Failed to render PDF page.");

    viewer.remove();
  });

  it("covers pan start with non-left mouse button and touch without touches[0]", async () => {
    const viewer = new ShadowClawPdfViewer();
    document.body.appendChild(viewer);
    viewer.file = {
      name: "sample.pdf",
      binaryContent: new Uint8Array([1, 2, 3, 4]),
    };
    await Promise.resolve();
    await Promise.resolve();

    const wrap = viewer.shadowRoot?.querySelector(
      ".pdf-canvas-wrap",
    ) as HTMLElement;

    // Right click (button = 2) should not start panning
    wrap.dispatchEvent(
      new MouseEvent("mousedown", { button: 2, clientX: 10, clientY: 10 }),
    );
    expect(viewer._isPanning).toBe(false);

    // Touch event with changedTouches fallback
    const touchEvent = new CustomEvent("touchstart", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(touchEvent, "touches", { value: [] });
    Object.defineProperty(touchEvent, "changedTouches", {
      value: [{ clientX: 20, clientY: 30 }],
    });
    wrap.dispatchEvent(touchEvent);
    expect(viewer._isPanning).toBe(true);

    // Touch event with empty touches and changedTouches
    const emptyTouchEvent = new CustomEvent("touchmove", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(emptyTouchEvent, "touches", { value: [] });
    Object.defineProperty(emptyTouchEvent, "changedTouches", { value: [] });
    globalThis.dispatchEvent(emptyTouchEvent);

    viewer.stopPanning();
    viewer.remove();
  });

  it("covers null shadowRoot, missing canvas, and non-HTMLElement wrap guards", async () => {
    const viewer = new ShadowClawPdfViewer();

    // connectedCallback throws if no shadowRoot
    Object.defineProperty(viewer, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(viewer.connectedCallback()).rejects.toThrow(
      "shadowRoot not found",
    );

    viewer.bindEvents();
    viewer.setStatus("msg");
    viewer.updateControls();
    viewer.updatePanState();
    await viewer.loadPdf();
    await viewer.renderCurrentPage();

    // getRenderScale with <= 0 width
    expect(viewer.getRenderScale(0)).toBe(viewer._scale);

    // Empty shadowRoot
    const fakeRoot = document.createElement("div");
    Object.defineProperty(viewer, "shadowRoot", {
      value: fakeRoot,
      configurable: true,
    });
    viewer.updateControls();
    viewer.updatePanState();
    await viewer.renderCurrentPage();
  });
});
