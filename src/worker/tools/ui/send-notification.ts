import { post } from "../../utils/post.js";

export function executeSendNotification(
  input: Record<string, any>,
  groupId: string,
): string {
  post({
    type: "send-notification",
    payload: {
      body: input.body,
      groupId,
      title: input.title || "ShadowClaw",
    },
  });

  return `Push notification sent: ${input.body}`;
}
