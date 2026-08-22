export function normalizeCustomElementScriptSrc(src) {
  const isLocal =
    !src.startsWith("http://") &&
    !src.startsWith("https://") &&
    !src.startsWith("//");
  return isLocal
    ? src.replace(/^(pages\/)?(resources\/|deps\/|main\/)?/, "")
    : src;
}
