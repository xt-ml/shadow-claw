import DOMPurify, { Config } from "dompurify";

export type HashInput = File | Blob | ArrayBuffer | ArrayBufferView;

/**
 * Format a date for use in a filename: yyyy-mm-dd_hh-mm-ss
 */
export function formatDateForFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());

  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

/**
 * Format a timestamp for display: e.g. "Sun, Mar 1, 1:25 PM"
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Escape HTML special characters in a string.
 */
export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;

  return div.innerHTML;
}

/**
 * Sanitize HTML content using DOMPurify, allowing custom element tags.
 */
export function sanitizeHtml(
  dirty: string | Node = "",
  options: Config = {},
): string {
  return DOMPurify.sanitize(dirty, {
    CUSTOM_ELEMENT_HANDLING: {
      // any hyphenated custom element
      tagNameCheck: /^.*-.*$/,
      attributeNameCheck: null,
      allowCustomizedBuiltInElements: false,
    },
    ...options,
  });
}

/**
 * Interface representing the detailed internal navigation parameters
 */
export interface ShadowClawNavigateDetail {
  page: string;
  groupId?: string;
  path?: string;
  anchor?: string;
}

/**
 * Parses a special or relative link and dispatches the 'shadow-claw-navigate' custom event on document.
 * Returns true if the link was handled/intercepted, false otherwise.
 */
export function handleSpecialLinkNavigation(
  href: string,
  basePath: string = "",
  currentGroupId?: string,
): boolean {
  let trimmed = href.trim();
  if (!trimmed) {
    return false;
  }

  // Handle malformed query strings where '?' is used instead of '&' (e.g. #Page?param1=val1?param2=val2)
  const firstQuestion = trimmed.indexOf("?");
  if (firstQuestion !== -1) {
    const before = trimmed.slice(0, firstQuestion + 1);
    const after = trimmed.slice(firstQuestion + 1);
    trimmed = before + after.replace(/\?/g, "&");
  }

  // 1. Check if it is a case-insensitive special link starting with "/#" or "#" matching standard pages
  if (trimmed.startsWith("/#") || trimmed.startsWith("#")) {
    const withoutHash = trimmed.startsWith("/#")
      ? trimmed.slice(2)
      : trimmed.slice(1);

    // Parse parts: Page?query#anchor
    const pagePart = withoutHash.split(/[?#]/, 1)[0];
    const pageName = pagePart.toLowerCase();

    // Valid pages
    const validPages = ["chat", "files", "tasks", "pages", "settings"];
    if (validPages.includes(pageName)) {
      // Create a dummy absolute URL to parse searchParams easily
      const fakeUrl = trimmed.startsWith("/#")
        ? trimmed.replace(/^\/#/, "http://local/")
        : trimmed.replace(/^#/, "http://local/");
      const urlLike = new URL(fakeUrl, "http://local/");

      const groupId =
        urlLike.searchParams.get("groupId") ||
        urlLike.searchParams.get("conversationId") ||
        currentGroupId;
      const path =
        urlLike.searchParams.get("file") ||
        urlLike.searchParams.get("path") ||
        undefined;
      // Support: ?anchor=some-heading, ?anchor=L10-L20, or #fragment
      const anchorParam = urlLike.searchParams.get("anchor");
      const anchor = anchorParam
        ? anchorParam
        : urlLike.hash
          ? urlLike.hash.slice(1)
          : undefined;

      const detail: ShadowClawNavigateDetail = {
        page: pageName,
        groupId: groupId || undefined,
        path: path || undefined,
        anchor: anchor || undefined,
      };

      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail,
          bubbles: true,
          composed: true,
        }),
      );

      return true;
    }
  }

  // 2. Relative or absolute workspace paths, e.g., "docs/README.md"
  // If it does not have a scheme (http, https, mailto, etc.) and is not external:
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
  if (
    !hasScheme &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("javascript:")
  ) {
    // Resolve absolute vs relative
    let resolvedPath = trimmed.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    const isAbsolute = resolvedPath.startsWith("/");
    resolvedPath = resolvedPath.replace(/^\/+/, "");

    const urlLike = new URL(trimmed, "http://local/");
    const anchor = urlLike.hash ? urlLike.hash.slice(1) : undefined;

    let finalPath = resolvedPath;
    if (!isAbsolute && basePath) {
      const baseParts = basePath
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .split("/")
        .filter(Boolean);
      baseParts.pop(); // Remove the filename of base path

      const pathParts = resolvedPath.split("/");
      const stack = [...baseParts];
      for (const part of pathParts) {
        if (!part || part === ".") {
          continue;
        }

        if (part === "..") {
          stack.pop();
        } else {
          stack.push(part);
        }
      }

      finalPath = stack.join("/");
    }

    if (finalPath) {
      // Determine target page: pages if it's markdown, files otherwise
      const isMarkdown = /\.(md|markdown)$/i.test(finalPath);
      const targetPage = isMarkdown ? "pages" : "files";

      const detail: ShadowClawNavigateDetail = {
        page: targetPage,
        groupId: currentGroupId || undefined,
        path: finalPath,
        anchor: anchor || undefined,
      };

      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail,
          bubbles: true,
          composed: true,
        }),
      );

      return true;
    }
  }

  return false;
}

/**
 * Convert various input types to an ArrayBuffer for hashing.
 */
export function toArrayBuffer(input: HashInput): Promise<ArrayBuffer> {
  if (input instanceof Blob) {
    return input.arrayBuffer();
  }

  if (input instanceof ArrayBuffer) {
    return Promise.resolve(input.slice(0) as ArrayBuffer);
  }

  const { buffer, byteOffset, byteLength } = input;

  return Promise.resolve(
    buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer,
  );
}

/**
 * Convert an ArrayBuffer to a hex string.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the SHA-256 hash and return it as a hex string.
 */
export async function computeSha256(input: HashInput): Promise<string> {
  const data = await toArrayBuffer(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return bufferToHex(hashBuffer);
}
