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
});
