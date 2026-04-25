import { getRecentMessages } from "./getRecentMessages.js";
import type { ConversationMessage } from "../types.js";

/**
 * Build conversation messages for Claude API
 */
export async function buildConversationMessages(
  groupId: string,
  limit: number,
): Promise<ConversationMessage[]> {
  const messages = await getRecentMessages(groupId, limit);

  return messages.map((m) => ({
    role: m.isFromMe ? "assistant" : "user",
    content: m.isFromMe ? m.content : `${m.sender}: ${m.content}`,
  }));
}
