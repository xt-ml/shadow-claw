export function normalizeWorkspacePath(inputPath: string): string {
  return inputPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

export function hasPathTraversal(path: string): boolean {
  return path
    .split("/")
    .filter(Boolean)
    .some((part) => part === "..");
}

export function escapeMarkdownLabel(label: string): string {
  return label.replace(/[\[\]\\]/g, "\\$&");
}

export function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(path);
}

export const IMAGE_MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;

export function getImageMimeType(path: string): string | null {
  const ext = path.toLowerCase().split(".").pop() || "";

  return IMAGE_MIME_TYPES[ext] || null;
}

export function isBinaryContent(bytes: Uint8Array): boolean {
  const sampleSize = Math.min(bytes.length, 8192);
  let nonPrintable = 0;

  for (let i = 0; i < sampleSize; i++) {
    const b = bytes[i];
    if (b === 0) {
      return true;
    }

    if (b < 32 && b !== 9 && b !== 10 && b !== 1) {
      nonPrintable++;
    }
  }

  return nonPrintable / sampleSize > 0.1;
}
