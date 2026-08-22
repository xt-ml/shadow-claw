import { normalizeCustomElementScriptSrc } from "./normalize-custom-element-script-src.mjs";

export function buildCustomElementScriptTags(approvedEntries, escapeHtml) {
  if (!Array.isArray(approvedEntries) || approvedEntries.length === 0) {
    return "";
  }

  return approvedEntries
    .map((entry) => {
      if (typeof entry === "string") {
        const src = normalizeCustomElementScriptSrc(entry);
        return `    <script type="module" src="${escapeHtml(src)}"></script>`;
      }

      if (entry && typeof entry === "object" && entry.src) {
        const src = normalizeCustomElementScriptSrc(entry.src);
        const type = entry.type
          ? ` type="${escapeHtml(entry.type)}"`
          : ' type="module"';
        const asyncAttr = entry.async ? " async" : "";
        const deferAttr = entry.defer ? " defer" : "";
        return `    <script${type}${asyncAttr}${deferAttr} src="${escapeHtml(src)}"></script>`;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}
