/**
 * Clears srcdoc and removes preview iframe from shadow root if present.
 */
export function removePreviewIframe(root: ShadowRoot | HTMLElement): void {
  const iframe = root.querySelector("[data-pages-iframe]");
  if (!(iframe instanceof HTMLIFrameElement)) {
    return;
  }

  iframe.removeAttribute("srcdoc");
  iframe.remove();
}
