export interface FilenameOptions {
  replacement?: string;
  fallback?: string;
  stripLeadingDots?: boolean;
  collapseReplacement?: boolean;
  stripControlChars?: boolean;
}

/**
 * Extracts the trailing filename/basename component from a path string.
 * Supports both POSIX ('/') and Windows ('\\') path separators.
 */
export function basename(path: string, fallback = "attachment.bin"): string {
  if (!path) {
    return fallback;
  }

  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  return parts[parts.length - 1] || fallback;
}

/**
 * Sanitizes a filename by replacing or stripping characters illegal in file systems.
 */
export function sanitizeFilename(
  value: string,
  options: FilenameOptions = {},
): string {
  const replacement = options.replacement ?? "_";
  const fallback = options.fallback ?? "attachment.bin";

  let sanitized = value.trim();

  if (options.stripControlChars) {
    sanitized = sanitized.replace(/[\u0000-\u001f\u007f]+/g, "");
  }

  if (options.stripLeadingDots) {
    sanitized = sanitized.replace(/^\.+/, "");
  }

  const illegalCharsRegex = options.stripControlChars
    ? /[\\/:*?"<>|]/g
    : /[\\/:*?"<>|\x00-\x1f\u007f]/g;

  if (options.collapseReplacement && replacement) {
    const escaped = replacement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(
      options.stripControlChars
        ? /[\\/:*?"<>|]+/g
        : /[\\/:*?"<>|\x00-\x1f\u007f]+/g,
      replacement,
    );
    sanitized = sanitized.replace(new RegExp(`${escaped}+`, "g"), replacement);
  } else {
    sanitized = sanitized.replace(illegalCharsRegex, replacement);
  }

  sanitized = sanitized.trim();
  if (options.stripLeadingDots) {
    sanitized = sanitized.replace(/^\.+/, "").trim();
  }

  return sanitized || fallback;
}

/**
 * Unified single function that extracts the basename and sanitizes it in one operation.
 */
export function cleanFilename(
  pathOrName: string,
  options: FilenameOptions = {},
): string {
  const base = basename(pathOrName, options.fallback);

  return sanitizeFilename(base, options);
}
