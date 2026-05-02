import { getAttachmentCategory } from "../attachment-capabilities.js";
import { readGroupFileBytes } from "../storage/readGroupFileBytes.js";
import { getDb } from "./db.js";
import { getRecentMessages } from "./getRecentMessages.js";
import type {
  AttachmentContent,
  ConversationMessage,
  MessageAttachment,
} from "../types.js";

const MAX_NATIVE_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_NATIVE_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_NATIVE_DOCUMENT_BYTES = 20 * 1024 * 1024;

/**
 * Build conversation messages for Claude API
 */
export async function buildConversationMessages(
  groupId: string,
  limit: number,
): Promise<ConversationMessage[]> {
  const messages = await getRecentMessages(groupId, limit);
  const db = await getDb();

  const mappedMessages = await Promise.all(
    messages.map(async (m) => {
      if (m.isFromMe) {
        return {
          role: "assistant" as const,
          content: m.content,
        };
      }

      const text = `${m.sender}: ${m.content}`;
      const attachmentBlocks = await buildAttachmentBlocks(
        db,
        groupId,
        m.attachments || [],
      );

      if (attachmentBlocks.length === 0) {
        return {
          role: "user" as const,
          content: text,
        };
      }

      return {
        role: "user" as const,
        content: [{ type: "text" as const, text }, ...attachmentBlocks],
      };
    }),
  );

  return mappedMessages;
}

async function buildAttachmentBlocks(
  db: Awaited<ReturnType<typeof getDb>>,
  groupId: string,
  attachments: MessageAttachment[],
): Promise<AttachmentContent[]> {
  const blocks: AttachmentContent[] = [];

  for (const attachment of attachments) {
    const mimeType = attachment.mimeType || "application/octet-stream";
    const category = getAttachmentCategory(mimeType, attachment.fileName);
    // Map "text" and "document" → use native mediaType labels; "text" files reach
    // here only if they exceeded the inline budget and were stored as attachments.
    const mediaType: AttachmentContent["mediaType"] =
      category === "text"
        ? "file"
        : category === "document"
          ? "document"
          : (category as AttachmentContent["mediaType"]);
    const block: AttachmentContent = {
      type: "attachment",
      mediaType,
      fileName: attachment.fileName,
      mimeType,
      size: attachment.size,
      path: attachment.path,
    };

    if (
      db &&
      mediaType === "image" &&
      attachment.path &&
      (attachment.size || 0) <= MAX_NATIVE_IMAGE_BYTES
    ) {
      try {
        const bytes = await readGroupFileBytes(db, groupId, attachment.path);
        block.data = toBase64(bytes);
      } catch {
        // If the file cannot be read, keep metadata-only fallback.
      }
    }

    if (
      db &&
      mediaType === "audio" &&
      attachment.path &&
      (attachment.size || 0) <= MAX_NATIVE_AUDIO_BYTES
    ) {
      try {
        const bytes = await readGroupFileBytes(db, groupId, attachment.path);
        block.data = toBase64(bytes);
      } catch {
        // Keep metadata-only fallback.
      }
    }

    if (
      db &&
      mediaType === "document" &&
      attachment.path &&
      (attachment.size || 0) <= MAX_NATIVE_DOCUMENT_BYTES
    ) {
      try {
        const bytes = await readGroupFileBytes(db, groupId, attachment.path);
        block.data = toBase64(bytes);
      } catch {
        // Keep metadata-only fallback.
      }
    }

    if (
      db &&
      mediaType === "audio" &&
      attachment.path &&
      (attachment.size || 0) <= MAX_NATIVE_AUDIO_BYTES
    ) {
      try {
        const bytes = await readGroupFileBytes(db, groupId, attachment.path);
        block.data = toBase64(bytes);
      } catch {
        // Keep metadata-only fallback.
      }
    }

    if (
      db &&
      mediaType === "document" &&
      attachment.path &&
      (attachment.size || 0) <= MAX_NATIVE_DOCUMENT_BYTES
    ) {
      try {
        const bytes = await readGroupFileBytes(db, groupId, attachment.path);
        block.data = toBase64(bytes);
      } catch {
        // Keep metadata-only fallback.
      }
    }

    blocks.push(block);
  }

  return blocks;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
