import { post } from "../../utils/post.js";

export function executeCreateRoom(
  input: Record<string, any>,
): string {
  const name = String(input.name || "").trim();

  if (!name) {
    return "Error: a room name is required.";
  }

  post({
    type: "room-action",
    payload: { action: "create", name },
  });

  return `Creating room "${name}". You will be the host; once it is ready you can invite peers with invite_to_room.`;
}
