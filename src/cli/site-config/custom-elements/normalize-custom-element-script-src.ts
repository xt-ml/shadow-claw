export function normalizeCustomElementScriptSrc(
  src: string,
  basePath?: string,
): string {
  const isLocal =
    !src.startsWith("http://") &&
    !src.startsWith("https://") &&
    !src.startsWith("//");
  if (!isLocal) {
    return src;
  }
  // Strip common page-asset prefixes (pages/main/, resources/, deps/)
  const stripped = src.replace(/^(pages\/)?(resources\/|deps\/|main\/)?/, "");

  const effectiveBase = basePath || process.env.PAGES_BASE_PATH || "";
  if (effectiveBase && effectiveBase !== "/") {
    const cleanBase = effectiveBase.endsWith("/")
      ? effectiveBase
      : `${effectiveBase}/`;
    const cleanStripped = stripped.replace(/^\//, "");
    if (!cleanStripped.startsWith(cleanBase.replace(/^\//, ""))) {
      return `${cleanBase}${cleanStripped}`;
    }
    return cleanStripped.startsWith("/") ? cleanStripped : `/${cleanStripped}`;
  }

  // Ensure local paths are root-relative so they resolve correctly from any route.
  // Without this, paths like ".agents/scripts/main/block-garden-adapter.js" 404
  // when the page is served from a non-root URL (e.g. /chat or /main/about/).
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}
