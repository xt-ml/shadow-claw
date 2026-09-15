export function normalizeCustomElementScriptSrc(src: string): string {
  const isLocal =
    !src.startsWith("http://") &&
    !src.startsWith("https://") &&
    !src.startsWith("//");
  return isLocal
    ? src.replace(/^(pages\/)?(resources\/|deps\/|main\/)?/, "")
    : src;
}
