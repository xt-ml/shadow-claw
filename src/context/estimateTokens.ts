import type { ConversationMessage } from "../types.js";

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
