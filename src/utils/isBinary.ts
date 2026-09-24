import { getMimeType } from "./mime.js";

function isBinaryMime(mime: string): boolean {
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime.includes("application/pdf") ||
    mime.includes("application/octet-stream") ||
    mime.includes("application/zip") ||
    mime.includes("application/gzip") ||
    mime.includes("application/x-tar") ||
    mime.includes("application/vnd.rar") ||
    mime.includes("application/wasm") ||
    mime.includes("application/vnd.sqlite3") ||
    mime.includes("application/vnd.microsoft.portable-executable")
  );
}

/**
 * Checks if a byte buffer or content-type/path represents binary (non-text) content.
 */
export function isBinary(input: Uint8Array | string): boolean {
  if (input instanceof Uint8Array) {
    if (input.length === 0) {
      return false;
    }

    const sampleSize = Math.min(input.length, 8192);
    let nonPrintable = 0;

    for (let i = 0; i < sampleSize; i++) {
      const b = input[i];
      if (b === 0) {
        return true;
      }

      // Check non-printable control characters, allowing tab (9), newline (10), CR (13)
      if (b < 32 && b !== 9 && b !== 10 && b !== 13) {
        nonPrintable++;
      }
    }

    return nonPrintable / sampleSize > 0.1;
  }

  if (typeof input === "string") {
    const lower = input.toLowerCase().trim();

    // Check if input is directly a binary MIME type
    if (isBinaryMime(lower)) {
      return true;
    }

    // Check if input has an inferred MIME type that is binary
    const inferred = getMimeType(lower);
    if (inferred && isBinaryMime(inferred)) {
      return true;
    }

    // Common binary extensions if not in MIME map
    if (
      lower.endsWith(".bin") ||
      lower.endsWith(".exe") ||
      lower.endsWith(".dmg") ||
      lower.endsWith(".iso") ||
      lower.endsWith(".tar") ||
      lower.endsWith(".gz")
    ) {
      return true;
    }

    return false;
  }

  return false;
}

/**
 * Legacy compatibility alias for checking raw bytes.
 */
export function isBinaryContent(bytes: Uint8Array): boolean {
  return isBinary(bytes);
}

/**
 * Legacy compatibility alias for checking content-type string.
 */
export function isBinaryContentType(contentType: string): boolean {
  return isBinary(contentType);
}
