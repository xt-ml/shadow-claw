import { jest } from "@jest/globals";

jest.unstable_mockModule("../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

const { FileViewerStore } = await import("./file-viewer.js");
const { readGroupFile } = await import("../storage/readGroupFile.js");
const { readGroupFileBytes } = await import("../storage/readGroupFileBytes.js");

describe("FileViewerStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens file and stores basename/content", async () => {
    (readGroupFile as any).mockResolvedValue("hello");
    const s = new FileViewerStore();

    await s.openFile({} as any, "a/b/c.txt", "g1");

    expect(s.file).toEqual({
      name: "c.txt",
      path: "a/b/c.txt",
      content: "hello",
      kind: "text",
      binaryContent: null,
      mimeType: "text/plain",
    });
  });

  it("closeFile clears state", () => {
    const s = new FileViewerStore();

    (s as any)._file.set({
      name: "x",
      content: "y",
      kind: "text",
      binaryContent: null,
      mimeType: "text/plain",
    });
    s.closeFile();

    expect(s.getFile()).toBeNull();
  });

  it("openFile sets file name from path when no slash", async () => {
    (readGroupFile as any).mockResolvedValue("content");
    const s = new FileViewerStore();

    await s.openFile({} as any, "single-file.txt", "g1");

    expect(s.file).toEqual({
      name: "single-file.txt",
      path: "single-file.txt",
      content: "content",
      kind: "text",
      binaryContent: null,
      mimeType: "text/plain",
    });
  });

  it("openFile reads pdf as binary content", async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);

    (readGroupFileBytes as any).mockResolvedValue(pdfBytes);
    const s = new FileViewerStore();

    await s.openFile({} as any, "folder/manual.pdf", "g1");

    expect(readGroupFileBytes).toHaveBeenCalledWith(
      {},
      "g1",
      "folder/manual.pdf",
    );

    expect(readGroupFile).not.toHaveBeenCalled();

    expect(s.file).toEqual({
      name: "manual.pdf",
      path: "folder/manual.pdf",
      content: "",
      kind: "pdf",
      binaryContent: pdfBytes,
      mimeType: "application/pdf",
    });
  });

  it("openFile reads browser-previewable binaries as bytes", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71]);

    (readGroupFileBytes as any).mockResolvedValue(pngBytes);
    const s = new FileViewerStore();

    await s.openFile({} as any, "images/logo.png", "g1");

    expect(readGroupFileBytes).toHaveBeenCalledWith(
      {},
      "g1",
      "images/logo.png",
    );
    expect(readGroupFile).not.toHaveBeenCalled();
    expect(s.file).toEqual({
      name: "logo.png",
      path: "images/logo.png",
      content: "",
      kind: "binary",
      binaryContent: pngBytes,
      mimeType: "image/png",
    });
  });

  it("openFile throws when readGroupFile fails", async () => {
    const err = new Error("File not found");

    (readGroupFile as any).mockRejectedValue(err);
    const s = new FileViewerStore();

    await expect(s.openFile({} as any, "a/b/c.txt", "g1")).rejects.toThrow(
      "File not found",
    );
  });

  it("openFile uses DEFAULT_GROUP_ID when not provided", async () => {
    (readGroupFile as any).mockResolvedValue("content");
    const s = new FileViewerStore();

    await s.openFile({} as any, "file.txt");

    expect(readGroupFile).toHaveBeenCalledWith(
      {} as any,
      "br:main",
      "file.txt",
    );

    expect(s.file).toEqual({
      name: "file.txt",
      path: "file.txt",
      content: "content",
      kind: "text",
      binaryContent: null,
      mimeType: "text/plain",
    });
  });
});
