import { post } from "../../utils/post.js";

export function executeShowToast(input: Record<string, any>): string {
  post({
    type: "show-toast",
    payload: {
      duration: input.duration,
      message: input.message,
      type: input.type || "info",
    },
  });

  return `Toast notification sent: ${input.message}`;
}
