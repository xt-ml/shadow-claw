import { post } from "../../utils/post.js";

export function executeManageTools(
  input: Record<string, any>,
  groupId: string,
): string {
  const { action, tool_names, profile_id } = input;
  post({
    type: "manage-tools",
    payload: {
      action,
      groupId,
      profileId: profile_id,
      toolNames: tool_names,
    },
  });

  return `Tool management request sent: ${action}${profile_id ? " " + profile_id : ""}${tool_names ? " (" + tool_names.join(", ") + ")" : ""}`;
}
