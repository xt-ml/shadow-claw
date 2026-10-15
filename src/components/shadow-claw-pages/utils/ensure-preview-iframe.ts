import { getIframeSandboxPolicy } from "../../../security/custom-element-security.js";

export interface EnsurePreviewIframeOptions {
  root: ShadowRoot | HTMLElement;
  rendered: HTMLElement;
  selectedPath?: string | null;
  onIframeLoad?: (contentWindow: Window | null) => void;
}

/**
 * Returns existing or creates a new sandboxed preview iframe element inserted before rendered container.
 */
export function ensurePreviewIframe({
  root,
  rendered,
  selectedPath,
  onIframeLoad,
}: EnsurePreviewIframeOptions): HTMLIFrameElement {
  const existing = root.querySelector("[data-pages-iframe]");
  if (existing instanceof HTMLIFrameElement) {
    return existing;
  }

  const iframe = document.createElement("iframe");
  iframe.className = "pages__iframe";
  iframe.setAttribute("data-pages-iframe", "");
  iframe.setAttribute(
    "title",
    selectedPath ? `Preview: ${selectedPath}` : "Page preview",
  );
  iframe.setAttribute("sandbox", getIframeSandboxPolicy());
  iframe.setAttribute("allow", "fullscreen");
  iframe.hidden = true;
  if (onIframeLoad) {
    iframe.addEventListener("load", () => {
      onIframeLoad(iframe.contentWindow);
    });
  }
  rendered.before(iframe);

  return iframe;
}
