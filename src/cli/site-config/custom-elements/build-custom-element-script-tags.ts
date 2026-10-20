import { normalizeCustomElementScriptSrc } from "./normalize-custom-element-script-src.js";

export interface CustomElementScriptDescriptor {
  src: string;
  id?: string;
  name?: string;
  global?: boolean;
  autoload?: boolean;
  type?: string;
  async?: boolean;
  defer?: boolean;
  hasInit?: boolean;
}

export type CustomElementScriptEntry = string | CustomElementScriptDescriptor;

function defaultEscapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildCustomElementScriptTags(
  approvedEntries: CustomElementScriptEntry[] | any,
  escapeHtml: (str: string) => string = defaultEscapeHtml,
): string {
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
        const tags = [
          `    <script${type}${asyncAttr}${deferAttr} src="${escapeHtml(src)}"></script>`,
        ];
        // Emit a companion inline module that calls m.init() so that scripts
        // declaring hasInit:true (like block-garden-adapter.js) actually run
        // their initialization and install BroadcastChannel bridges.
        if (entry.hasInit) {
          tags.push(
            `    <script type="module">import("${escapeHtml(src)}").then((m) => { try { if (typeof m?.init === "function") m.init(); } catch (e) { console.error("[ShadowClaw] Error executing init for ${escapeHtml(src)}", e); } }).catch(() => {});</script>`,
          );
        }
        return tags.join("\n");
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}
