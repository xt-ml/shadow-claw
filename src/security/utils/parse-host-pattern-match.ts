/**
 * Parse a user pattern (domain name, wildcard, or regex) into a matcher function.
 * Pure utility with zero runtime dependencies.
 */
export function parseHostPatternMatch(
  patternStr: string,
): (hostname: string) => boolean {
  const trimmed = patternStr.trim();
  if (!trimmed) {
    return () => false;
  }

  // Regex format: /pattern/flags
  if (
    trimmed.startsWith("/") &&
    (trimmed.endsWith("/") || /\/[gimuy]*$/.test(trimmed))
  ) {
    try {
      const lastSlash = trimmed.lastIndexOf("/");
      const pattern = trimmed.slice(1, lastSlash);
      const flags = trimmed.slice(lastSlash + 1);

      const re = new RegExp(pattern, flags || "i");

      return (h: string) => re.test(h);
    } catch {
      // Fall back to plain string matching if regex is invalid
    }
  }

  // Regex format without slashes (starts with ^ or ends with $)
  if (
    trimmed.includes("^") ||
    trimmed.includes("$") ||
    (trimmed.includes("(") && trimmed.includes(")"))
  ) {
    try {
      const re = new RegExp(trimmed, "i");

      return (h: string) => re.test(h);
    } catch {
      // Fall back
    }
  }

  // Wildcard format: *.domain.com
  if (trimmed.startsWith("*.")) {
    const domain = trimmed.slice(2).toLowerCase();

    return (h: string) => {
      const lh = h.toLowerCase();

      return lh === domain || lh.endsWith("." + domain);
    };
  }

  // Standard domain format (e.g. youtube.com or xt-ml.github.io)
  const domain = trimmed.toLowerCase();

  return (h: string) => {
    const lh = h.toLowerCase();

    return lh === domain || lh.endsWith("." + domain);
  };
}
