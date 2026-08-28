/**
 * Maps a file extension to its corresponding image MIME type.
 * Defaults to 'image/jpeg' if the extension is unrecognized.
 */
export function mimeTypeForImageExt(ext: string): string {
  const map: Record<string, string> = {
    apng: "image/apng",
    avif: "image/avif",
    gif: "image/gif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp",
  };

  return map[ext] ?? "image/jpeg";
}
