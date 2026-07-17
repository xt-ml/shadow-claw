import { readGroupFile } from "../../../storage/readGroupFile.js";
import { ShadowClawDatabase } from "../../../db/types.js";
import {
  normalizeWorkspacePath,
  hasPathTraversal,
  escapeMarkdownLabel,
  isImagePath,
} from "./workspace-utils.js";

export async function executeAttachFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  if (!input.path || typeof input.path !== "string") {
    return "Error: attach_file_to_chat requires a valid path string.";
  }

  const normalizedPath = normalizeWorkspacePath(input.path);
  if (!normalizedPath) {
    return "Error: attach_file_to_chat received an empty file path.";
  }

  if (hasPathTraversal(normalizedPath)) {
    return "Error: attach_file_to_chat path cannot contain '..' segments.";
  }

  try {
    // Verify the file exists in the current group workspace.
    await readGroupFile(db, groupId, normalizedPath);
  } catch (err: any) {
    return `Error: attach_file_to_chat could not find ${normalizedPath}: ${err?.message || String(err)}`;
  }

  const defaultLabel = normalizedPath.split("/").pop() || normalizedPath;
  const labelInput =
    typeof input.alt === "string" && input.alt.trim()
      ? input.alt.trim()
      : defaultLabel;

  const label = escapeMarkdownLabel(labelInput);

  const markdown = isImagePath(normalizedPath)
    ? `![${label}](${normalizedPath})`
    : `[${label}](${normalizedPath})`;

  return (
    `Attachment prepared: ${normalizedPath}\n` +
    "Please include the following markdown in your response to show it to the user:\n" +
    markdown
  );
}
