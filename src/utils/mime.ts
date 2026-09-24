/**
 * Comprehensive mapping of file extensions to their corresponding MIME types.
 */
export const IMAGE_MIME_TYPES: Record<string, string> = {
  apng: "image/apng",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

export const MIME_TYPES: Record<string, string> = {
  ...IMAGE_MIME_TYPES,
  "3gp": "video/3gpp",
  aac: "audio/aac",
  avi: "video/x-msvideo",
  bin: "application/octet-stream",
  css: "text/css",
  csv: "text/csv",
  db: "application/vnd.sqlite3",
  dll: "application/octet-stream",
  dmg: "application/octet-stream",
  dylib: "application/octet-stream",
  exe: "application/vnd.microsoft.portable-executable",
  flac: "audio/flac",
  flv: "video/x-flv",
  gz: "application/gzip",
  htm: "text/html",
  html: "text/html",
  iso: "application/octet-stream",
  js: "text/javascript",
  json: "application/json",
  m4a: "audio/mp4",
  m4v: "video/mp4",
  markdown: "text/markdown",
  md: "text/markdown",
  mjs: "text/javascript",
  mkv: "video/x-matroska",
  mov: "video/mp4",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  ogv: "video/ogg",
  pdf: "application/pdf",
  rar: "application/vnd.rar",
  so: "application/octet-stream",
  sqlite: "application/vnd.sqlite3",
  sqlite3: "application/vnd.sqlite3",
  tar: "application/x-tar",
  ts: "text/typescript",
  tsx: "text/typescript",
  txt: "text/plain",
  wasm: "application/wasm",
  wav: "audio/wav",
  weba: "audio/webm",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
  xml: "application/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  zip: "application/zip",
};

/**
 * Extract lowercased file extension from a path or filename.
 */
function getExtension(pathOrFilename: string): string {
  if (!pathOrFilename) {
    return "";
  }

  const clean = pathOrFilename.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const filename = clean.split("/").pop() || "";

  return filename.toLowerCase().split(".").pop() || "";
}

/**
 * Returns the MIME type for a given file path or name, or fallback if not recognized.
 */
export function getMimeType(
  pathOrFilename: string,
  fallback?: string,
): string | undefined {
  const ext = getExtension(pathOrFilename);

  return MIME_TYPES[ext] ?? fallback;
}

/**
 * Returns the image MIME type for a file if it is an image, otherwise null.
 */
export function getImageMimeType(pathOrFilename: string): string | null {
  const ext = getExtension(pathOrFilename);

  return IMAGE_MIME_TYPES[ext] || null;
}

/**
 * Returns true if the given path has a supported image extension.
 */
export function isImagePath(pathOrFilename: string): boolean {
  return getImageMimeType(pathOrFilename) !== null;
}

/**
 * Checks if the MIME type of a path matches a specific MIME type or prefix (e.g. 'image/').
 */
export function isMimeType(
  pathOrFilename: string,
  expectedTypeOrPrefix: string,
): boolean {
  const mimeType = getMimeType(pathOrFilename);
  if (!mimeType) {
    return false;
  }

  if (expectedTypeOrPrefix.endsWith("/")) {
    return mimeType.startsWith(expectedTypeOrPrefix);
  }

  return mimeType === expectedTypeOrPrefix;
}

/**
 * Guess MIME type from filename (compat with email tool).
 * Special-cases `.md` to `text/plain` for email compatibility.
 */
export function guessMimeTypeFromFilename(
  filename: string,
): string | undefined {
  const ext = getExtension(filename);
  if (ext === "md" || ext === "markdown" || ext === "txt") {
    return "text/plain";
  }

  if (ext === "pdf") {
    return "application/pdf";
  }

  if (IMAGE_MIME_TYPES[ext]) {
    return IMAGE_MIME_TYPES[ext];
  }

  return undefined;
}

/**
 * Infer MIME type for attachment, preferring explicit MIME type if provided.
 */
export function inferAttachmentMimeType(
  fileName: string,
  explicitMimeType = "",
): string {
  if (explicitMimeType) {
    return explicitMimeType;
  }

  return getMimeType(fileName, "application/octet-stream")!;
}

export interface MimeOptions {
  imageOnly?: boolean;
  fallback?: string;
}

/**
 * Unified single function covering both general MIME lookup and image-only lookup.
 */
export function mime(
  pathOrFilename: string,
  options?: MimeOptions | string,
): string | null | undefined {
  if (typeof options === "string") {
    return getMimeType(pathOrFilename, options);
  }

  if (options?.imageOnly) {
    return getImageMimeType(pathOrFilename);
  }

  return getMimeType(pathOrFilename, options?.fallback);
}
