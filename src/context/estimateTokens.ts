import type {
  AttachmentContent,
  ConversationMessage,
} from "../content/types.js";

/**
 * @module estimateTokens
 *
 * Lightweight token estimation using a character-based heuristic.
 * ~4 characters per token for English text is a reasonable approximation
 * that avoids shipping a full tokenizer to the browser.
 */

/** Average characters per token for English text */
const CHARS_PER_TOKEN = 4;

/** Per-message overhead (role label, formatting tokens) */
const MESSAGE_OVERHEAD_TOKENS = 4;

/**
 * Token estimation for attachments.
 */
const IMAGE_DATA_TOKENS = 1500;
const AUDIO_DATA_TOKENS = 1500;
const VIDEO_DATA_TOKENS = 2500;

/**
 * Approximation for tokenizing binary files based on length.
 */
const BINARY_DOC_BYTES_PER_TOKEN = 16;

/**
 * Estimate the byte length of an attachment block.
 */
function attachmentByteLength(block: AttachmentContent): number {
  if (typeof block.size === "number" && block.size > 0) {
    return block.size;
  }

  if (typeof block.data === "string" && block.data.length > 0) {
    const padding = block.data.endsWith("==")
      ? 2
      : block.data.endsWith("=")
        ? 1
        : 0;

    return Math.max(0, Math.floor((block.data.length * 3) / 4) - padding);
  }

  return 0;
}

/**
 * Check if a mime type represents text-like data.
 */
function isTextLikeMime(mimeType: string | undefined): boolean {
  if (!mimeType) {
    return false;
  }

  return (
    mimeType.startsWith("text/") ||
    mimeType === "json" ||
    mimeType === "xml" ||
    mimeType === "javascript" ||
    mimeType === "csv" ||
    mimeType === "markdown"
  );
}

function estimateAttachmentDataTokens(block: AttachmentContent): number {
  const bytes = attachmentByteLength(block);
  if (bytes === 0) {
    return 0;
  }

  switch (block.mediaType) {
    case "image":
      return IMAGE_DATA_TOKENS;
    case "audio":
      return AUDIO_DATA_TOKENS;
    case "video":
      return VIDEO_DATA_TOKENS;
    case "document":
    case "file":
    default:
      return isTextLikeMime(block.mimeType)
        ? Math.ceil(bytes / CHARS_PER_TOKEN)
        : Math.ceil(bytes / BINARY_DOC_BYTES_PER_TOKEN);
  }
}

/**
 * Estimate the number of tokens in a text string.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a single conversation message.
 * Handles both string content and array content (tool_use / tool_result blocks).
 */
export function estimateMessageTokens(message: ConversationMessage): number {
  let contentTokens = 0;

  if (typeof message.content === "string") {
    contentTokens = estimateTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block.type === "text" && block.text) {
        contentTokens += estimateTokens(block.text);
      } else if (block.type === "tool_use") {
        contentTokens += estimateTokens(block.name);
        contentTokens += estimateTokens(JSON.stringify(block.input));
      } else if (block.type === "tool_result") {
        const c = block.content;
        contentTokens += estimateTokens(
          typeof c === "string" ? c : JSON.stringify(c),
        );
      } else if (block.type === "attachment") {
        contentTokens += estimateTokens(block.fileName);
        contentTokens += estimateTokens(block.mimeType);
        contentTokens += estimateTokens(block.path);
        contentTokens += estimateAttachmentDataTokens(block);
      }
    }
  }

  return contentTokens + MESSAGE_OVERHEAD_TOKENS;
}

/**
 * Estimate total tokens for an array of conversation messages.
 */
export function estimateMessagesTokens(
  messages: ConversationMessage[],
): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }

  return total;
}
