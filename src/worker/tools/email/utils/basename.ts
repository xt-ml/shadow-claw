export function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  return parts[parts.length - 1] || "attachment.bin";
}
