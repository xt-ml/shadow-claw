import { describe, expect, it } from "@jest/globals";
import {
  buildAttachmentContentBlocks,
  DEFAULT_MAX_INLINE_TEXT_BYTES,
  MAX_NATIVE_IMAGE_BYTES,
} from "./buildAttachmentContentBlocks.js";
import type { MessageAttachment } from "./types.js";

describe("buildAttachmentContentBlocks", () => {
  it("inlines small text files as text content blocks", async () => {
    const textEncoder = new TextEncoder();
    const attachments: MessageAttachment[] = [
      {
        fileName: "foo.txt",
        mimeType: "text/plain",
        size: 8,
        path: "attachments/foo.txt",
      },
    ];

    const blocks = await buildAttachmentContentBlocks(attachments, async () =>
      textEncoder.encode("it works"),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].text).toContain("foo.txt");
      expect(blocks[0].text).toContain("it works");
    }
  });

  it("inlines markdown files and json files as text", async () => {
    const textEncoder = new TextEncoder();
    const attachments: MessageAttachment[] = [
      {
        fileName: "data.json",
        mimeType: "application/json",
        size: 15,
      },
    ];

    const blocks = await buildAttachmentContentBlocks(attachments, async () =>
      textEncoder.encode('{"key":"value"}'),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].text).toContain('{"key":"value"}');
    }
  });

  it("keeps text files as metadata-only attachments when exceeding maxInlineTextBytes", async () => {
    const attachments: MessageAttachment[] = [
      {
        fileName: "large.txt",
        mimeType: "text/plain",
        size: DEFAULT_MAX_INLINE_TEXT_BYTES + 10,
        path: "attachments/large.txt",
      },
    ];

    const blocks = await buildAttachmentContentBlocks(
      attachments,
      async () => new Uint8Array(DEFAULT_MAX_INLINE_TEXT_BYTES + 10),
      { maxInlineTextBytes: DEFAULT_MAX_INLINE_TEXT_BYTES },
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "attachment",
      mediaType: "file",
      fileName: "large.txt",
      mimeType: "text/plain",
      size: DEFAULT_MAX_INLINE_TEXT_BYTES + 10,
      path: "attachments/large.txt",
    });
  });

  it("encodes image files as base64 attachment blocks within size limit", async () => {
    const attachments: MessageAttachment[] = [
      {
        fileName: "photo.png",
        mimeType: "image/png",
        size: 3,
        path: "attachments/photo.png",
      },
    ];

    const blocks = await buildAttachmentContentBlocks(
      attachments,
      async () => new Uint8Array([112, 110, 103]),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "attachment",
      mediaType: "image",
      fileName: "photo.png",
      mimeType: "image/png",
      size: 3,
      path: "attachments/photo.png",
      data: "cG5n",
    });
  });

  it("omits base64 data for image exceeding MAX_NATIVE_IMAGE_BYTES", async () => {
    const attachments: MessageAttachment[] = [
      {
        fileName: "huge.png",
        mimeType: "image/png",
        size: MAX_NATIVE_IMAGE_BYTES + 100,
        path: "attachments/huge.png",
      },
    ];

    const blocks = await buildAttachmentContentBlocks(
      attachments,
      async () => new Uint8Array(MAX_NATIVE_IMAGE_BYTES + 100),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "attachment",
      mediaType: "image",
      fileName: "huge.png",
      mimeType: "image/png",
      size: MAX_NATIVE_IMAGE_BYTES + 100,
      path: "attachments/huge.png",
    });
  });

  it("encodes audio files as base64 within MAX_NATIVE_AUDIO_BYTES", async () => {
    const attachments: MessageAttachment[] = [
      {
        fileName: "sound.mp3",
        mimeType: "audio/mpeg",
        size: 4,
        path: "attachments/sound.mp3",
      },
    ];

    const blocks = await buildAttachmentContentBlocks(
      attachments,
      async () => new Uint8Array([1, 2, 3, 4]),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "attachment",
      mediaType: "audio",
      data: expect.any(String),
    });
  });

  it("encodes PDF document files as base64 within MAX_NATIVE_DOCUMENT_BYTES", async () => {
    const attachments: MessageAttachment[] = [
      {
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        size: 5,
        path: "attachments/doc.pdf",
      },
    ];

    const blocks = await buildAttachmentContentBlocks(
      attachments,
      async () => new Uint8Array([37, 80, 68, 70, 45]),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "attachment",
      mediaType: "document",
      data: expect.any(String),
    });
  });

  it("falls back to metadata block without data when readBytes fails or returns null", async () => {
    const attachments: MessageAttachment[] = [
      {
        fileName: "photo.png",
        mimeType: "image/png",
        size: 100,
        path: "attachments/photo.png",
      },
      {
        fileName: "notes.txt",
        mimeType: "text/plain",
        size: 50,
        path: "attachments/notes.txt",
      },
    ];

    const blocks = await buildAttachmentContentBlocks(attachments, async () => {
      throw new Error("Disk read error");
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: "attachment",
      mediaType: "image",
      fileName: "photo.png",
      mimeType: "image/png",
      size: 100,
      path: "attachments/photo.png",
    });
    expect(blocks[1]).toEqual({
      type: "attachment",
      mediaType: "file",
      fileName: "notes.txt",
      mimeType: "text/plain",
      size: 50,
      path: "attachments/notes.txt",
    });
  });
});
