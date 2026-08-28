/**
 * Determines whether key, touch, or mouse navigation should be suppressed
 * based on event target elements, active focus, contenteditable attributes, or data attributes.
 */
export function isNavigationSuppressed(
  event?: UIEvent | Event | null,
  extraEl?: EventTarget | null,
): boolean {
  const navAttributes = [
    "data-no-nav",
    "data-no-swipe",
    "data-no-page-nav",
    "data-prevent-nav",
    "data-prevent-page-nav",
    "data-isolate-input",
    "data-isolate-navigation",
    "data-game-controls",
  ];

  const checkElement = (el: EventTarget | null): boolean => {
    if (!el || !(el instanceof HTMLElement)) {
      return false;
    }
    const tagName = el.tagName.toLowerCase();
    if (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      tagName === "option" ||
      tagName === "iframe"
    ) {
      return true;
    }
    if (
      el.classList.contains("pages__preview-frame") ||
      el.isContentEditable ||
      el.contentEditable === "true" ||
      el.getAttribute("contenteditable") === "true" ||
      el.hasAttribute("contenteditable")
    ) {
      return true;
    }
    if (
      el.closest("[data-pages-list]") ||
      el.closest("[data-pages-dropdown]") ||
      el.closest(".pages__sidebar") ||
      el.closest(".pages__preview-frame") ||
      el.closest("iframe") ||
      navAttributes.some((attr) => el.closest(`[${attr}]`))
    ) {
      return true;
    }
    return false;
  };

  if (extraEl && checkElement(extraEl)) {
    return true;
  }

  if (event) {
    const path =
      typeof (event as any).composedPath === "function"
        ? (event as any).composedPath()
        : [];
    for (const node of path) {
      if (node instanceof HTMLElement) {
        const nodeTag = node.tagName.toLowerCase();
        if (
          navAttributes.some((attr) => node.hasAttribute(attr)) ||
          nodeTag === "input" ||
          nodeTag === "textarea" ||
          nodeTag === "select" ||
          nodeTag === "option" ||
          nodeTag === "iframe" ||
          node.classList.contains("pages__preview-frame") ||
          node.isContentEditable ||
          node.contentEditable === "true" ||
          node.getAttribute("contenteditable") === "true" ||
          node.hasAttribute("contenteditable")
        ) {
          return true;
        }
      }
    }
    if (event.target && checkElement(event.target)) {
      return true;
    }
  }

  return false;
}
