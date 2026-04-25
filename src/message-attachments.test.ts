import { jest } from "@jest/globals";

const mockUploadGroupFile = jest.fn() as any;

jest.unstable_mockModule("./storage/uploadGroupFile.js", () => ({
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
});
