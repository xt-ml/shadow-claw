import { bytesToBase64 } from "../utils/base64.js";
import { getAttachmentCategory } from "./attachment-capabilities.js";
import type {
  AttachmentContent,
  ContentBlock,
  MessageAttachment,
} from "./types.js";

export const DEFAULT_MAX_INLINE_TEXT_BYTES = 100 * 1024; // 100 KB
export const MAX_NATIVE_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
export const MAX_NATIVE_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_NATIVE_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export interface BuildAttachmentContentBlocksOptions {
  maxInlineTextBytes?: number;
}

/**
 * Converts stored message attachments into model-ready ContentBlocks.
 *
 * - Small text/code files (≤ maxInlineTextBytes) are inlined directly as `TextContent` blocks.
 * - Supported media (images, audio, PDF documents) within size limits are encoded as base64 `AttachmentContent` blocks.
 * - Files exceeding limits, unsupported types, or unreadable attachments degrade to metadata-only `AttachmentContent` blocks.
 */
export async function buildAttachmentContentBlocks(
  attachments: MessageAttachment[] = [],
  readBytes: (attachment: MessageAttachment) => Promise<Uint8Array | null>,
  options: BuildAttachmentContentBlocksOptions = {},
): Promise<ContentBlock[]> {
  const maxInlineTextBytes =
    options.maxInlineTextBytes ?? DEFAULT_MAX_INLINE_TEXT_BYTES;
  const blocks: ContentBlock[] = [];

  for (const attachment of attachments) {
    const mimeType = attachment.mimeType || "application/octet-stream";
    const category = getAttachmentCategory(mimeType, attachment.fileName);

    const mediaType: AttachmentContent["mediaType"] =
      category === "text"
        ? "file"
        : category === "document"
          ? "document"
          : (category as AttachmentContent["mediaType"]);

    let bytes: Uint8Array | null = null;
    try {
      bytes = await readBytes(attachment);
    } catch {
      bytes = null;
    }

    const effectiveSize =
      bytes?.length ??
      (typeof attachment.size === "number" ? attachment.size : 0);

    // 1. Text category: inline small files as text blocks
    if (category === "text" && bytes && effectiveSize <= maxInlineTextBytes) {
      try {
        const textDecoder = new TextDecoder("utf-8");
        const content = textDecoder.decode(bytes);
        const fence = content.includes("```") ? "~~~~" : "```";
        blocks.push({
          type: "text",
          text: `Attachment: ${attachment.fileName}\n${fence}\n${content}\n${fence}`,
        });
        continue;
      } catch {
        // Fall back to attachment block if UTF-8 decoding fails
      }
    }

    // 2. Media / binary category: base64 attachment block
    const block: AttachmentContent = {
      type: "attachment",
      mediaType,
      fileName: attachment.fileName,
      mimeType,
      size: attachment.size,
      path: attachment.path,
    };

    if (bytes) {
      if (mediaType === "image" && effectiveSize <= MAX_NATIVE_IMAGE_BYTES) {
        block.data = bytesToBase64(bytes);
      } else if (
        mediaType === "audio" &&
        effectiveSize <= MAX_NATIVE_AUDIO_BYTES
      ) {
        block.data = bytesToBase64(bytes);
      } else if (
        mediaType === "document" &&
        effectiveSize <= MAX_NATIVE_DOCUMENT_BYTES
      ) {
        block.data = bytesToBase64(bytes);
      }
    }

    blocks.push(block);
  }

  return blocks;
}
