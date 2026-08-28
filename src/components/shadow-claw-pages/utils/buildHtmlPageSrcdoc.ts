import type { Config } from "dompurify";
import {
  applyBasePath,
  getFileRouteDirPath,
} from "../../../core/app-routes.js";
import { rewriteWorkspacePreviewHtml } from "./rewriteWorkspacePreviewHtml.js";
import { sanitizeSrcdocHtml } from "../../../security/trusted-types.js";
import {
  getIframeHtmlClass,
  getIframeThemeStyleHtml,
} from "../../../ui/iframe-theme.js";
import {
  getApprovedCustomElementScripts,
  getIframeCsp,
} from "../../../security/custom-element-security.js";

export const defaultPreviewSanitizeOptions: Config = {
  // Allow blob URLs for locally resolved OPFS preview assets.
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ["iframe", "figure", "figcaption"],
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: null,
    attributeNameCheck: null,
  },
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
  const bridgeScriptUrl = applyBasePath(
    "/assets/file-viewer-preview-bridge.js",
  );
  const storageBridgeScriptUrl = applyBasePath(
    "/assets/iframe-storage-bridge.js",
  );

  const approvedScripts = getApprovedCustomElementScripts();
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
    ? `<script nonce="${nonce}">(function(){try{Object.defineProperty(window.location,"search",{get:function(){return ${JSON.stringify(searchParams)};},configurable:true});}catch(e){}})();</script>`
    : "";

  const customElementScriptsHtml = approvedScripts
    .map((src) => {
      const isExternal =
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("//");
      const resolvedSrc = isExternal
        ? src
        : applyBasePath(
            src.startsWith("/") ? src : `/${src.replace(/^pages\/main\//, "")}`,
          );
      return `<script type="module" src="${resolvedSrc}" nonce="${nonce}"></script>`;
    })
    .join("\n");

  const themeStylesheetLink = `<link rel="stylesheet" href="${applyBasePath(
    "/theme.css",
  )}">`;

  return [
    "<!doctype html>",
    `<html class="${getIframeHtmlClass()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`,
    `<base href="${routeDir}" target="_blank">`,
    searchScriptHtml,
    siteConfigHtml,
    `<script src="${storageBridgeScriptUrl}" nonce="${nonce}"></script>`,
    `<script src="${bridgeScriptUrl}" nonce="${nonce}"></script>`,
    getIframeThemeStyleHtml(),
    themeStylesheetLink,
    customElementScriptsHtml,
    "</head><body>",
    safeContent,
    "</body></html>",
  ].join("");
}
