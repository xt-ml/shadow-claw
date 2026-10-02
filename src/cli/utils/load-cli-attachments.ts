import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MessageAttachment } from "../../content/types.js";
import { inferAttachmentMimeType } from "../../utils/mime.js";

export function normalizeFileOption(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];

  return list.map((v) => String(v)).filter(Boolean);
}

export async function loadCliAttachments(
  files: string[],
): Promise<MessageAttachment[]> {
  const attachments: MessageAttachment[] = [];

  for (const file of files) {
    const resolved = path.resolve(file);
    let bytes: Buffer;

    try {
      bytes = await readFile(resolved);
    } catch (err: any) {
      throw new Error(
        `Error: Failed to read attachment file "${file}": ${err.message}`,
      );
    }

    const fileName = path.basename(resolved);
    const mimeType = inferAttachmentMimeType(fileName, "");

    attachments.push({
      fileName,
      mimeType,
      size: bytes.length,
      source: {
        kind: "local-file",
        file: new Blob([new Uint8Array(bytes)], { type: mimeType }),
      },
    });
  }

  return attachments;
}
