import { post } from "../../utils/post.js";

export function executeDeleteTask(
  input: Record<string, any>,
  groupId: string,
): string {
  if (!input.id) {
    return "Error: Missing required task ID for deletion.";
  }

  post({ type: "delete-task", payload: { id: input.id, groupId } });

  return `Task ${input.id} deleted successfully.`;
}
