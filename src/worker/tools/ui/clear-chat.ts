import { post } from "../../utils/post.js";

export function executeClearChat(groupId: string): string {
  post({ type: "clear-chat", payload: { groupId } });

  return "Chat history cleared successfully. New session started.";
}
