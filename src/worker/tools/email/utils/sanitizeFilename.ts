export function sanitizeFilename(value: string): string {
  const sanitized = value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim();

  return sanitized || "attachment.bin";
}
