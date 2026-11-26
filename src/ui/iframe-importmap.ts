import { applyBasePath } from "../core/app-routes.js";
import type { CustomElementScriptDescriptor } from "../security/custom-element-security.js";

export interface BuildIframeImportMapOptions {
  origin?: string;
  nonce: string;
}

/**
 * Builds a nonce-gated `<script type="importmap">` tag with absolute URLs for
 * `about:srcdoc` preview iframes so bare `shadow-claw/*` specifiers resolve
 * inside sandboxed iframes (which do not inherit the host importmap).
 */
export function buildIframeImportMapHtml({
  origin = typeof window !== "undefined" ? window.location?.origin : "",
  nonce,
}: BuildIframeImportMapOptions): string {
  const cleanOrigin =
    typeof origin === "string" && /^https?:\/\//i.test(origin)
      ? origin.replace(/\/+$/, "")
      : "";

  const imports: Record<string, string> = {};
  if (cleanOrigin) {
    const libBase = `${cleanOrigin}${applyBasePath("/lib/")}`;
    Object.assign(imports, {
      "shadow-claw": `${libBase}index.js`,
      "shadow-claw/": libBase,
      "shadow-claw/components": `${libBase}components/index.js`,
      "shadow-claw/components/": `${libBase}components/`,
      "shadow-claw/components/shadow-claw-element": `${libBase}components/shadow-claw-element.js`,
      "shadow-claw/components/base-styles": `${libBase}components/base-styles.js`,
      "shadow-claw/components/shadow-claw-resize-handle": `${libBase}components/shadow-claw-resize-handle.js`,
      "shadow-claw/components/shadow-claw-status-bar": `${libBase}components/shadow-claw-status-bar.js`,
      "shadow-claw/components/shadow-claw-card": `${libBase}components/shadow-claw-card.js`,
      "shadow-claw/components/shadow-claw-dialog": `${libBase}components/shadow-claw-dialog.js`,
      "shadow-claw/components/shadow-claw-empty-state": `${libBase}components/shadow-claw-empty-state.js`,
      "shadow-claw/components/shadow-claw-actions": `${libBase}components/shadow-claw-actions.js`,
      "shadow-claw/utils": `${libBase}utils/index.js`,
      "shadow-claw/utils/": `${libBase}utils/`,
      "shadow-claw/utils/page-swipe-guard": `${libBase}utils/page-swipe-guard.js`,
      "shadow-claw/utils/workbench-fullscreen": `${libBase}utils/workbench-fullscreen.js`,
      "shadow-claw/utils/workspace-fs": `${libBase}utils/workspace-fs.js`,
      "shadow-claw/utils/tool-adapter-bridge": `${libBase}utils/tool-adapter-bridge.js`,
      "shadow-claw/signals": `${libBase}utils/signals.js`,
    });
  }

  if (typeof document !== "undefined") {
    const hostImportMap = document.querySelector(
      'script[type="importmap"][data-shadow-claw-importmap], script[type="importmap"]',
    );
    if (hostImportMap?.textContent) {
      try {
        const parsed = JSON.parse(hostImportMap.textContent);
        if (parsed?.imports && typeof parsed.imports === "object") {
          for (const [spec, target] of Object.entries(parsed.imports)) {
            if (typeof target === "string") {
              if (target.startsWith("/")) {
                if (cleanOrigin) {
                  imports[spec] = `${cleanOrigin}${target}`;
                }
              } else if (cleanOrigin || /^https?:\/\//i.test(target)) {
                imports[spec] = target;
              }
            }
          }
        }
      } catch {}
    }
  }

  if (Object.keys(imports).length === 0) {
    return "";
  }

  const serializedMap = JSON.stringify({ imports }).replace(
    /<\/script/gi,
    "<\\/script",
  );
  return `<script type="importmap" nonce="${nonce}">${serializedMap}</script>`;
}

/**
 * Renders nonce-gated `<script type="module">` tags (and optional `init()`
 * invocations) for approved custom element script descriptors.
 */
export function buildIframeCustomElementScriptsHtml(
  scripts: CustomElementScriptDescriptor[],
  nonce: string,
): string {
  return scripts
    .map(({ src, hasInit }) => {
      const isExternal =
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("//");
      const resolvedSrc = isExternal
        ? src
        : applyBasePath(
            src.startsWith("/") ? src : `/${src.replace(/^pages\/main\//, "")}`,
          );
      const tags = [
        `<script type="module" src="${resolvedSrc}" nonce="${nonce}"></script>`,
      ];
      if (hasInit) {
        tags.push(
          `<script type="module" nonce="${nonce}">import("${resolvedSrc}").then((m) => { try { if (typeof m?.init === "function") m.init(); } catch (e) { console.error("[ShadowClaw] Error executing init for " + ${JSON.stringify(resolvedSrc)}, e); } }).catch(() => {});</script>`,
        );
      }
      return tags.join("\n");
    })
    .join("\n");
}
