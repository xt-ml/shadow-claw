import { jest } from "@jest/globals";

jest.unstable_mockModule("../storage/readGroupFile.mjs", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/readGroupFileBytes.mjs", () => ({
  readGroupFileBytes: jest.fn(),
}));

const { FileViewerStore } = await import("./file-viewer.mjs");
const { readGroupFile } = await import("../storage/readGroupFile.mjs");
const { readGroupFileBytes } =
  await import("../storage/readGroupFileBytes.mjs");

describe("FileViewerStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens file and stores basename/content", async () => {
    readGroupFile.mockResolvedValue("hello");
    const s = new FileViewerStore();

    await s.openFile({}, "a/b/c.txt", "g1");

    expect(s.file).toEqual({
      name: "c.txt",
      content: "hello",
      kind: "text",
      binaryContent: null,
    });
  });

  it("closeFile clears state", () => {
    const s = new FileViewerStore();
    s._file.set({
      name: "x",
      content: "y",
      kind: "text",
      binaryContent: null,
    });
    s.closeFile();
    expect(s.getFile()).toBeNull();
  });

  it("openFile sets file name from path when no slash", async () => {
    readGroupFile.mockResolvedValue("content");
    const s = new FileViewerStore();

    await s.openFile({}, "single-file.txt", "g1");

    expect(s.file).toEqual({
      name: "single-file.txt",
      content: "content",
      kind: "text",
      binaryContent: null,
    });
  });

  it("openFile reads pdf as binary content", async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    readGroupFileBytes.mockResolvedValue(pdfBytes);
    const s = new FileViewerStore();

    await s.openFile({}, "docs/manual.pdf", "g1");

    expect(readGroupFileBytes).toHaveBeenCalledWith(
      {},
      "g1",
      "docs/manual.pdf",
    );
    expect(readGroupFile).not.toHaveBeenCalled();
    expect(s.file).toEqual({
      name: "manual.pdf",
      content: "",
      kind: "pdf",
      binaryContent: pdfBytes,
    });
  });

  it("openFile throws when readGroupFile fails", async () => {
    const err = new Error("File not found");
    readGroupFile.mockRejectedValue(err);
    const s = new FileViewerStore();

    await expect(s.openFile({}, "a/b/c.txt", "g1")).rejects.toThrow(
      "File not found",
    );
  });

  it("openFile uses DEFAULT_GROUP_ID when not provided", async () => {
    readGroupFile.mockResolvedValue("content");
    const s = new FileViewerStore();

    await s.openFile({}, "file.txt");

    expect(readGroupFile).toHaveBeenCalledWith({}, "br:main", "file.txt");
    expect(s.file).toEqual({
      name: "file.txt",
      content: "content",
      kind: "text",
      binaryContent: null,
    });
  });
});
