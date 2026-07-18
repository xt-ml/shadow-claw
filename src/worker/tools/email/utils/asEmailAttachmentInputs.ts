import { EmailAttachmentInput } from "../email.js";

export function asEmailAttachmentInputs(
  value: unknown,
): EmailAttachmentInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: EmailAttachmentInput[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const path = item.trim();
      if (path) {
        parsed.push({ path });
      }

      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const path =
      typeof (item as { path?: unknown }).path === "string"
        ? (item as { path: string }).path.trim()
        : "";
    if (!path) {
      continue;
    }

    const filename =
      typeof (item as { filename?: unknown }).filename === "string"
        ? (item as { filename: string }).filename.trim()
        : "";

    const contentType =
      typeof (item as { content_type?: unknown }).content_type === "string"
        ? (item as { content_type: string }).content_type.trim()
        : "";

    parsed.push({
      path,
      filename: filename || undefined,
      contentType: contentType || undefined,
    });
  }

  return parsed;
}
