export function getTargetPath(loc: Location, ev: MouseEvent): string | null {
  // 1. Ignore modified clicks, non-left clicks, and canceled events
  if (
    ev.defaultPrevented ||
    ev.button !== 0 ||
    ev.metaKey ||
    ev.ctrlKey ||
    ev.shiftKey ||
    ev.altKey
  ) {
    return null;
  }

  // 2. Find the nearest HTMLAnchorElement in the event bubbling path
  const path = ev.composedPath();
  let link: HTMLAnchorElement | null = null;

  for (const el of path) {
    if (el instanceof HTMLAnchorElement) {
      link = el;

      break;
    }
  }

  // If no link was clicked, exit
  if (!link) {
    return null;
  }

  // 3. Ignore empty links or non-http protocols (js, mail, phone)
  const href = link.getAttribute("href") || "";
  if (
    !href ||
    href.startsWith("javascript:") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return null;
  }

  // 4. Ignore external targets (like target="_blank")
  if (link.target && link.target !== "_self") {
    return null;
  }

  // 5. Ignore completely external domains
  if (link.origin !== loc.origin) {
    return null;
  }

  // 6. Ignore hash-only changes on the current page (let the browser handle anchor scrolling)
  if (
    link.pathname === loc.pathname &&
    link.search === loc.search &&
    link.hash !== loc.hash
  ) {
    return null;
  }

  // 7. Success: Intercept the native browser behavior and extract the route
  ev.preventDefault();

  return `${link.pathname}${link.search}${link.hash}`;
}
