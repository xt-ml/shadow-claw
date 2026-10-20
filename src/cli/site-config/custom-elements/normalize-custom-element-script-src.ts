export function normalizeCustomElementScriptSrc(src: string): string {
  const isLocal =
    !src.startsWith("http://") &&
    !src.startsWith("https://") &&
    !src.startsWith("//");
  if (!isLocal) {
    return src;
  }
  // Strip common page-asset prefixes (pages/main/, resources/, deps/)
  const stripped = src.replace(/^(pages\/)?(resources\/|deps\/|main\/)?/, "");
  // Ensure local paths are root-relative so they resolve correctly from any route.
  // Without this, paths like ".agents/scripts/main/block-garden-adapter.js" 404
  // when the page is served from a non-root URL (e.g. /chat or /main/about/).
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}
