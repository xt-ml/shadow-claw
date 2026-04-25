import DOMPurify, { Config } from "dompurify";

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
