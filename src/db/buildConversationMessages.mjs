import { getRecentMessages } from "./getRecentMessages.mjs";

/**
 * @typedef {import("../types.mjs").ConversationMessage} ConversationMessage
 */

/**
 * Build conversation messages for Claude API
 *
 * @param {string} groupId
 * @param {number} limit
 *
 * @returns {Promise<ConversationMessage[]>}
 */
export async function buildConversationMessages(groupId, limit) {
  const messages = await getRecentMessages(groupId, limit);

  return messages.map((m) => ({
    role: m.isFromMe ? "assistant" : "user",
    content: m.isFromMe ? m.content : `${m.sender}: ${m.content}`,
  }));
}
