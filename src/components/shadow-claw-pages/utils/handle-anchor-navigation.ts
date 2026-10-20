/**
 * Scrolls a target element or named anchor into view inside a rendered page container or iframe.
 * Returns true if an anchor target was found and scrolled to.
 */
export function handleAnchorNavigation(
  anchor: string,
  renderedContainer: HTMLElement | null,
  iframe?: HTMLIFrameElement | null,
): boolean {
  if (!anchor) {
    return false;
  }

  const id = anchor.replace(/^#/, "");
  if (!id) {
    return false;
  }

  if (renderedContainer && !renderedContainer.hidden) {
    const target =
      renderedContainer.querySelector(`[id="${id}"]`) ||
      renderedContainer.querySelector(`a[name="${id}"]`);
    if (target) {
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      const pendingImages = Array.from(
        renderedContainer.querySelectorAll("img"),
      ).filter((img) => !img.complete);

      if (pendingImages.length > 0) {
        let recheckTimer: any;
        const onImgSettle = () => {
          clearTimeout(recheckTimer);
          recheckTimer = setTimeout(() => {
            if (typeof target.scrollIntoView === "function") {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 50);
        };
        for (const img of pendingImages) {
          img.addEventListener("load", onImgSettle, { once: true });
          img.addEventListener("error", onImgSettle, { once: true });
        }
      }

      return true;
    }
  }

  if (iframe && !iframe.hidden) {
    try {
      const doc = iframe.contentDocument;
      if (doc) {
        const target =
          doc.querySelector(`[id="${id}"]`) ||
          doc.querySelector(`a[name="${id}"]`);
        if (target) {
          if (typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          return true;
        }
      }
    } catch {}

    try {
      iframe.contentWindow?.postMessage(
        { type: "shadow-claw-scroll-to-anchor", anchor: id },
        "*",
      );
    } catch {}
  }

  return false;
}
