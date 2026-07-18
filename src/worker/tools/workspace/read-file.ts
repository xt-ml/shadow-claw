import { ShadowClawDatabase } from "../../../db/types.js";
import { readGroupFileBytes } from "../../../storage/readGroupFileBytes.js";
import { getImageMimeType } from "./utils/getImageMimeType.js";
import { isBinaryContent } from "./utils/isBinaryContent.js";

import { MAX_INLINE_IMAGE_BYTES } from "./types.js";

import type { ToolResultContentBlock } from "../../../content/types.js";

export async function executeReadFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string | ToolResultContentBlock[]> {
  const filePaths = input.paths || (input.path ? [input.path] : []);
  if (filePaths.length === 0) {
    return "Error: read_file requires path or paths.";
  }

  if (filePaths.length === 1) {
    const singlePath = filePaths[0];
    const mimeType = getImageMimeType(singlePath);

    if (mimeType) {
      try {
        const bytes = await readGroupFileBytes(db, groupId, singlePath);

        if (bytes.length > MAX_INLINE_IMAGE_BYTES) {
          return `Error: image file ${singlePath} is too large to inline (${bytes.length} bytes, max ${MAX_INLINE_IMAGE_BYTES}).`;
        }

        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }

        const base64 = btoa(binary);

        return [
          { type: "text", text: `Contents of image file: ${singlePath}` },
          { type: "image", media_type: mimeType, data: base64 },
        ] as ToolResultContentBlock[];
      } catch (err: any) {
        return `Error reading image ${singlePath}: ${err.message}`;
      }
    }

    try {
      const bytes = await readGroupFileBytes(db, groupId, singlePath);

      if (isBinaryContent(bytes)) {
        return (
          `Error: ${singlePath} is a binary file and cannot be displayed as text. ` +
          "Use open_file to view it in the UI, or attach_file_to_chat to share it."
        );
      }

      return new TextDecoder("utf-8").decode(bytes);
    } catch (err: any) {
      return `Error reading ${singlePath}: ${err.message}`;
    }
  }

  const sections = await Promise.all(
    filePaths.map(async (p: string) => {
      try {
        const mimeType = getImageMimeType(p);
        if (mimeType) {
          return `--- ${p} ---\n[Image file: use read_file with a single path to see this image]`;
        }

        const bytes = await readGroupFileBytes(db, groupId, p);

        if (isBinaryContent(bytes)) {
          return `--- ${p} ---\n[Binary file: cannot display as text]`;
        }

        const content = new TextDecoder("utf-8").decode(bytes);

        return `--- ${p} ---\n${content}`;
      } catch (err: any) {
        return `--- ${p} ---\nError reading ${p}: ${err.message}`;
      }
    }),
  );

  return sections.join("\n\n");
}
