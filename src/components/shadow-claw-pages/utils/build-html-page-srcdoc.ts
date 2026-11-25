import type { Config } from "dompurify";
import {
  applyBasePath,
  getFileRouteDirPath,
} from "../../../core/app-routes.js";
import { rewriteWorkspacePreviewHtml } from "./rewrite-workspace-preview-html.js";
import { sanitizeSrcdocHtml } from "../../../security/trusted-types.js";
import {
  getIframeHtmlClass,
  getIframeThemeStyleHtml,
  getIframeThemeStylesheetLink,
} from "../../../ui/iframe-theme.js";
import {
  getApprovedCustomElementScriptDescriptors,
  getIframeCsp,
  hasApprovedCustomElement,
  isAllowedCustomElement,
} from "../../../security/custom-element-security.js";
import {
  FILE_VIEWER_PREVIEW_BRIDGE_SCRIPT,
  IFRAME_STORAGE_BRIDGE_SCRIPT,
  safeInlineScript,
} from "../../shadow-claw-file-viewer/utils/iframe-bridge-scripts.js";

export const defaultPreviewSanitizeOptions: Config = {
  // Allow blob URLs for locally resolved OPFS preview assets.
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ["iframe", "figure", "figcaption"],
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: (tagName: string) => isAllowedCustomElement(tagName),
    attributeNameCheck: () => true,
    allowCustomizedBuiltInElements: false,
  },
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "frameborder",
    "scrolling",
    "referrerpolicy",
    "loading",
  ],
};

export interface BuildHtmlSrcdocOptions {
  content: string;
  filePath: string;
  searchParams?: string;
  groupId: string;
  origin?: string;
  sanitizeOptions?: Config;
  resolveRelativeImagesInHtmlFn?: (
    html: string,
    filePath: string,
    groupId: string,
  ) => Promise<string>;
}

/**
 * Builds complete HTML srcdoc document string for sandboxed iframe previews.
 */
export async function buildHtmlPageSrcdoc({
  content,
  filePath,
  searchParams = "",
  groupId,
  origin = typeof window !== "undefined" ? window.location?.origin : "",
  sanitizeOptions = defaultPreviewSanitizeOptions,
  resolveRelativeImagesInHtmlFn,
}: BuildHtmlSrcdocOptions): Promise<string> {
  const routeDir = applyBasePath(getFileRouteDirPath(groupId, filePath));
  const resolvedHtml = rewriteWorkspacePreviewHtml(
    content,
    filePath,
    routeDir,
    groupId,
    origin,
  );

  const inlinedHtml = resolveRelativeImagesInHtmlFn
    ? await resolveRelativeImagesInHtmlFn(resolvedHtml, filePath, groupId)
    : resolvedHtml;

  const safeContent = sanitizeSrcdocHtml(inlinedHtml, sanitizeOptions);

  // Nonce-gated CSP: only the bridge script and approved custom element scripts may run.
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const approvedScripts = getApprovedCustomElementScriptDescriptors();
  const cspContent = getIframeCsp(nonce);

  const configScript =
    typeof document !== "undefined"
      ? document.getElementById("shadow-claw-site-config")
      : null;
  const siteConfigHtml =
    configScript && configScript.textContent
      ? `<script id="shadow-claw-site-config" type="application/json">${configScript.textContent}</script>`
      : "";

  const searchScriptHtml = searchParams
    ? `<script nonce="${nonce}">(function(){try{Object.defineProperty(globalThis.location,"search",{get:function(){return ${JSON.stringify(searchParams)};},configurable:true});}catch(e){}})();</script>`
    : "";

  const scopedScripts = approvedScripts.filter((s) => !s.global);
  const shouldInjectCustomElementScripts =
    scopedScripts.length > 0 && hasApprovedCustomElement(safeContent);

  const customElementScriptsHtml = shouldInjectCustomElementScripts
    ? scopedScripts
        .map(({ src, hasInit }) => {
          const isExternal =
            src.startsWith("http://") ||
            src.startsWith("https://") ||
            src.startsWith("//");
          const resolvedSrc = isExternal
            ? src
            : applyBasePath(
                src.startsWith("/")
                  ? src
                  : `/${src.replace(/^pages\/main\//, "")}`,
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
        .join("\n")
    : "";

  let iframeImportMapHtml = "";
  if (shouldInjectCustomElementScripts) {
    const cleanOrigin =
      typeof origin === "string" && /^https?:\/\//i.test(origin)
        ? origin.replace(/\/+$/, "")
        : "";
    if (cleanOrigin) {
      const libBase = `${cleanOrigin}${applyBasePath("/lib/")}`;
      const imports: Record<string, string> = {
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
      };

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
                  imports[spec] = target.startsWith("/")
                    ? `${cleanOrigin}${target}`
                    : target;
                }
              }
            }
          } catch {}
        }
      }

      const serializedMap = JSON.stringify({ imports }).replace(
        /<\/script/gi,
        "<\\/script",
      );
      iframeImportMapHtml = `<script type="importmap" nonce="${nonce}">${serializedMap}</script>`;
    }
  }

  const themeStylesheetLink = getIframeThemeStylesheetLink();

  return [
    "<!doctype html>",
    `<html class="${getIframeHtmlClass()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`,
    `<base href="${routeDir}" target="_blank">`,
    searchScriptHtml,
    siteConfigHtml,
    iframeImportMapHtml,
    `<script nonce="${nonce}">${safeInlineScript(IFRAME_STORAGE_BRIDGE_SCRIPT)}</script>`,
    `<script nonce="${nonce}">${safeInlineScript(FILE_VIEWER_PREVIEW_BRIDGE_SCRIPT)}</script>`,
    getIframeThemeStyleHtml(),
    themeStylesheetLink,
    customElementScriptsHtml,
    `</head><body class="${getIframeHtmlClass()}">`,
    safeContent,
    "</body></html>",
  ].join("");
}
