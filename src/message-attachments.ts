import { uploadGroupFile } from "./storage/uploadGroupFile.js";
import type {
  MessageAttachment,
  MessageAttachmentSource,
  ShadowClawDatabase,
} from "./types.js";

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  apng: "image/apng",
  avif: "image/avif",
  bmp: "image/bmp",
  css: "text/css",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  markdown: "text/markdown",
  md: "text/markdown",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  ogv: "video/ogg",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
};

export function sanitizeAttachmentFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const normalized = trimmed
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  return normalized || "attachment";
}

export function inferAttachmentMimeType(
  fileName: string,
  explicitMimeType = "",
): string {
  if (explicitMimeType) {
    return explicitMimeType;
  }

  const extension = fileName.toLowerCase().split(".").pop() || "";

  return MIME_TYPES_BY_EXTENSION[extension] || "application/octet-stream";
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
  if (source.kind !== "remote-url") {
    throw new Error(`Unsupported attachment source: ${String(source)}`);
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
