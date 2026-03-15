/**
 * Format a date for use in a filename: yyyy-mm-dd_hh-mm-ss
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatDateForFilename(date = new Date()) {
  /** @param {any} n */
  const pad = (n) => String(n).padStart(2, "0");

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
 * @param {number} timestamp - epoch ms
 *
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
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
