import { post } from "../../post.js";
import { ulid } from "../../../utils/ulid.js";

export async function executeAskUser(
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const { question, options } = input;
  if (!question) {
    return "Error: question is required.";
  }

  const id = ulid();
  post({
    type: "ask-user",
    payload: { id, groupId, question, options },
  });

  return await new Promise<string>((resolve) => {
    (globalThis as any).pendingAskUserResolvers =
      (globalThis as any).pendingAskUserResolvers || {};

    (globalThis as any).pendingAskUserResolvers[id] = resolve;
  });
}
