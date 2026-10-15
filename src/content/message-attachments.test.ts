import { jest } from "@jest/globals";

const mockUploadGroupFile = jest.fn() as any;

jest.unstable_mockModule("../storage/upload-group-file.js", () => ({
  uploadGroupFile: mockUploadGroupFile,
}));

const {
  buildAttachmentStoragePath,
  inferAttachmentMimeType,
  persistMessageAttachments,
  sanitizeAttachmentFileName,
  shouldInlineAttachmentInChat,
} = await import("./message-attachments.js");

describe("message attachments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sanitizes unsafe attachment file names", () => {
    expect(sanitizeAttachmentFileName(" ../a:b?.png ")).toBe("-a-b-.png");
    expect(sanitizeAttachmentFileName("   ")).toBe("attachment");
  });

  it("infers mime type from file extension when missing", () => {
    expect(inferAttachmentMimeType("photo.png")).toBe("image/png");
    expect(inferAttachmentMimeType("notes.md")).toBe("text/markdown");
    expect(inferAttachmentMimeType("archive.bin")).toBe(
      "application/octet-stream",
    );
  });

  it("marks PNG attachments for inline chat rendering", () => {
    expect(
      shouldInlineAttachmentInChat({
        fileName: "photo.png",
        mimeType: "image/png",
      }),
    ).toBe(true);
    expect(
      shouldInlineAttachmentInChat({
        fileName: "manual.pdf",
        mimeType: "application/pdf",
      }),
    ).toBe(false);
  });

  it("builds attachment storage paths under attachments/", () => {
    expect(buildAttachmentStoragePath("photo.png", "abc", 123)).toBe(
      "attachments/123-abc-photo.png",
    );
  });

  it("persists remote attachments to the group workspace and strips source metadata", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      blob: async () => new Blob(["png-bytes"], { type: "image/png" }),
    })) as any;

    const persisted = await persistMessageAttachments({} as any, "tg:123", [
      {
        id: "photo-1",
        fileName: "photo.png",
        source: {
          kind: "remote-url",
          url: "https://example.com/photo.png",
        },
      },
    ]);

    expect(mockUploadGroupFile).toHaveBeenCalledTimes(1);
    expect(mockUploadGroupFile.mock.calls[0][1]).toBe("tg:123");
    expect(mockUploadGroupFile.mock.calls[0][2]).toContain("attachments/");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      id: "photo-1",
      fileName: "photo.png",
      mimeType: "image/png",
      previewDisposition: "inline",
    });
    expect(persisted[0].source).toBeUndefined();
    expect(persisted[0].path).toContain("attachments/");
  });

  it("inlines attachments when previewDisposition is explicitly inline", () => {
    expect(
      shouldInlineAttachmentInChat({
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        previewDisposition: "inline",
      }),
    ).toBe(true);
  });

  it("persists local-file and inline-text attachment sources", async () => {
    const localBlob = new Blob(["local data"], { type: "text/plain" });
    const persisted = await persistMessageAttachments({} as any, "group-1", [
      {
        id: "local-1",
        fileName: "notes.txt",
        source: {
          kind: "local-file",
          file: localBlob as any,
        },
      },
      {
        id: "inline-1",
        fileName: "code.js",
        source: {
          kind: "inline-text",
          text: "console.log(1);",
          mimeType: "application/javascript",
        },
      },
    ]);

    expect(persisted).toHaveLength(2);
    expect(persisted[0].mimeType).toBe("text/plain");
    expect(persisted[0].previewDisposition).toBe("file");
    expect(persisted[1].mimeType).toBe("application/javascript");
  });

  it("throws error when remote attachment download returns not ok", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
    })) as any;

    await expect(
      persistMessageAttachments({} as any, "group-1", [
        {
          id: "fail-1",
          fileName: "fail.png",
          source: { kind: "remote-url", url: "https://fail" },
        },
      ]),
    ).rejects.toThrow("Attachment download failed: HTTP 404 Not Found");
  });

  it("handles default attachments parameter and attachments without source", async () => {
    const empty = await persistMessageAttachments({} as any, "group-1");
    expect(empty).toEqual([]);

    const persisted = await persistMessageAttachments({} as any, "group-1", [
      {
        id: "meta-1",
        fileName: "doc.pdf",
        path: "custom/path.pdf",
        size: 1024,
        previewDisposition: "inline",
      },
    ]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].path).toBe("custom/path.pdf");
    expect(persisted[0].size).toBe(1024);
    expect(persisted[0].previewDisposition).toBe("inline");
  });

  it("handles inline-text attachment source without explicit mimeType", async () => {
    const persisted = await persistMessageAttachments({} as any, "group-1", [
      {
        id: "inline-default",
        fileName: "note.txt",
        source: {
          kind: "inline-text",
          text: "hello world",
        },
      },
    ]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].mimeType).toBe("text/plain");
  });
});
