export function sanitizeRenderedHtml(
  html: string,
  approvedScripts?: string[] | Set<string>,
): string {
  const allowedSet =
    approvedScripts instanceof Set
      ? approvedScripts
      : Array.isArray(approvedScripts)
        ? new Set(approvedScripts)
        : null;

  return html
    .replace(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/giu,
      (match, attrs, content) => {
        // Strip inline scripts that contain code
        if (content.trim()) {
          return "";
        }
        const srcMatch = attrs.match(
          /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/iu,
        );
        const src = srcMatch ? srcMatch[1] || srcMatch[2] || srcMatch[3] : "";
        if (!src) {
          return "";
        }
        if (allowedSet && allowedSet.size > 0) {
          const clean = src.split("?")[0].split("#")[0].trim();
          const stripPrefix = (s: string) =>
            s
              .replace(/^\.?\//, "")
              .replace(/^pages\/main\//, "")
              .toLowerCase();
          const normClean = stripPrefix(clean);
          const isAllowed = Array.from(allowedSet).some(
            (app) => app === clean || stripPrefix(app) === normClean,
          );
          if (isAllowed) {
            return match;
          }
        }
        return "";
      },
    )
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, "");
}
