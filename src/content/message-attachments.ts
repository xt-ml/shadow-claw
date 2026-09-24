import { uploadGroupFile } from "../storage/uploadGroupFile.js";
import type { MessageAttachment, MessageAttachmentSource } from "./types.js";
import type { ShadowClawDatabase } from "../db/types.js";
import { sanitizeFilename } from "../utils/filename.js";
import { inferAttachmentMimeType } from "../utils/mime.js";

export { inferAttachmentMimeType };

export function sanitizeAttachmentFileName(fileName: string): string {
  return sanitizeFilename(fileName, {
    replacement: "-",
    fallback: "attachment",
    stripLeadingDots: true,
    collapseReplacement: true,
    stripControlChars: true,
  });
}

export function shouldInlineAttachmentInChat(
  attachment: Pick<
    MessageAttachment,
    "fileName" | "mimeType" | "previewDisposition"
  >,
): boolean {
  if (attachment.previewDisposition === "inline") {
    return true;
  }

  return (
    inferAttachmentMimeType(attachment.fileName, attachment.mimeType || "") ===
    "image/png"
  );
}

export function buildAttachmentStoragePath(
  fileName: string,
  attachmentId = "",
  timestamp = Date.now(),
): string {
  const safeName = sanitizeAttachmentFileName(fileName);
  const safeId = attachmentId
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = safeId ? `${safeId}-` : "";

  return `attachments/${timestamp}-${prefix}${safeName}`;
}

export async function persistMessageAttachments(
  db: ShadowClawDatabase,
  groupId: string,
  attachments: MessageAttachment[] = [],
): Promise<MessageAttachment[]> {
  const persisted: MessageAttachment[] = [];

  for (const attachment of attachments) {
    const fileName = sanitizeAttachmentFileName(attachment.fileName || "");
    const path =
      attachment.path || buildAttachmentStoragePath(fileName, attachment.id);
    const source = attachment.source;

    let mimeType = inferAttachmentMimeType(fileName, attachment.mimeType || "");
    let size = attachment.size;

    if (source) {
      const blob = await readAttachmentSourceAsBlob(source);
      mimeType = inferAttachmentMimeType(
        fileName,
        attachment.mimeType || blob.type,
      );
      size = typeof size === "number" ? size : blob.size;
      await uploadGroupFile(db, groupId, path, blob);
    }

    persisted.push(
      stripAttachmentSource({
        ...attachment,
        fileName,
        mimeType,
        size,
        path,
        previewDisposition:
          attachment.previewDisposition ||
          (mimeType === "image/png" ? "inline" : "file"),
      }),
    );
  }

  return persisted;
}

async function readAttachmentSourceAsBlob(
  source: MessageAttachmentSource,
): Promise<Blob> {
  if (source.kind === "local-file") {
    return source.file;
  }

  if (source.kind === "inline-text") {
    return new Blob([source.text], {
      type: source.mimeType || "text/plain",
    });
  }

  const response = await fetch(source.url, {
    headers: source.headers,
  });

  if (!response.ok) {
    throw new Error(
      `Attachment download failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  return await response.blob();
}

function stripAttachmentSource(
  attachment: MessageAttachment,
): MessageAttachment {
  const { source, ...storedAttachment } = attachment;

  return storedAttachment;
}
