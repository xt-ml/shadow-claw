/** @typedef {import("./shell.mjs").ShellContext} ShellContext */

/**
 * Resolve a path relative to cwd
 *
 * @param {string} p
 * @param {ShellContext} ctx
 *
 * @returns {string}
 */
export function resolvePath(p, ctx) {
  // Strip /workspace prefix if present
  let cleaned = p.replace(/^\/workspace\/?/, "");
  if (!cleaned || cleaned === "/") return ".";

  // Resolve relative to cwd
  if (!cleaned.startsWith("/") && ctx.cwd !== ".") {
    cleaned = ctx.cwd + "/" + cleaned;
  }

  cleaned = cleaned.replace(/^\/+/, "");

  // Normalise . and ..
  const parts = [];
  for (const seg of cleaned.split("/")) {
    if (seg === "." || seg === "") {
      continue;
    }

    if (seg === "..") {
      parts.pop();

      continue;
    }

    parts.push(seg);
  }

  return parts.join("/") || ".";
}
