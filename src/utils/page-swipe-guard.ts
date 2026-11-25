export const SWIPE_GUARD_ATTRS = ["data-no-swipe", "data-no-nav"] as const;

interface AncestorGuardEntry {
  count: number;
  prev: Record<string, string | null>;
}

const DEFAULT_ANCESTOR_SELECTORS = [".pages__rendered", ".pages__viewer"];
const ancestorRefCounts = new WeakMap<Element, AncestorGuardEntry>();

export interface PageSwipeGuardOptions {
  extraSelectors?: string[];
}

/**
 * Suppresses ShadowClaw Pages horizontal swipe and arrow-key navigation across
 * the host element and its enclosing page viewer containers while mounted.
 * Uses WeakMap reference counting on shared ancestors so concurrent mounts or
 * view transitions keep protection intact and clean teardown restores prior state.
 */
export function installPageSwipeGuard(
  host: Element | null | undefined,
  options: PageSwipeGuardOptions = {},
): () => void {
  if (host && typeof host.setAttribute === "function") {
    for (const attr of SWIPE_GUARD_ATTRS) {
      host.setAttribute(attr, "true");
    }
  }

  const tracked: Element[] = [];
  if (host && typeof host.closest === "function") {
    const selectors = [
      ...DEFAULT_ANCESTOR_SELECTORS,
      ...(Array.isArray(options.extraSelectors) ? options.extraSelectors : []),
    ];
    const ancestors = new Set<Element>();
    for (const selector of selectors) {
      if (!selector) continue;
      const match = host.closest(selector);
      if (match) {
        ancestors.add(match);
      }
    }

    for (const el of ancestors) {
      if (typeof el.setAttribute !== "function") continue;
      let entry = ancestorRefCounts.get(el);
      if (!entry) {
        const prev: Record<string, string | null> = {};
        for (const attr of SWIPE_GUARD_ATTRS) {
          prev[attr] =
            typeof el.getAttribute === "function"
              ? el.getAttribute(attr)
              : null;
        }
        entry = { count: 0, prev };
      }

      entry.count += 1;
      ancestorRefCounts.set(el, entry);
      for (const attr of SWIPE_GUARD_ATTRS) {
        el.setAttribute(attr, "true");
      }
      tracked.push(el);
    }
  }

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;

    for (const el of tracked) {
      const entry = ancestorRefCounts.get(el);
      if (!entry) continue;
      entry.count -= 1;
      if (entry.count <= 0) {
        ancestorRefCounts.delete(el);
        for (const attr of SWIPE_GUARD_ATTRS) {
          const prevVal = entry.prev[attr];
          if (prevVal !== null && prevVal !== undefined) {
            el.setAttribute(attr, prevVal);
          } else if (typeof el.removeAttribute === "function") {
            el.removeAttribute(attr);
          }
        }
      }
    }
  };
}
