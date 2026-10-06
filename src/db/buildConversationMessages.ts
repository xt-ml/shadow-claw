import { buildAttachmentContentBlocks } from "../content/buildAttachmentContentBlocks.js";
import { readGroupFileBytes } from "../storage/readGroupFileBytes.js";
import { getDb } from "./db.js";
import { getRecentMessages } from "./getRecentMessages.js";
import type { ConversationMessage } from "../content/types.js";

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
      const attachments = m.attachments || [];

      if (attachments.length === 0) {
        return {
          role: "user" as const,
          content: text,
        };
      }

      const attachmentBlocks = await buildAttachmentContentBlocks(
        attachments,
        async (att) => {
          if (!db || !att.path) return null;
          return readGroupFileBytes(db, groupId, att.path);
        },
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
