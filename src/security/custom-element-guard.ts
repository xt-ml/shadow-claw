import { parseHostPatternMatch } from "./utils/parse-host-pattern-match.js";

/** Default allowed custom elements: none by default */
export const DEFAULT_ALLOWED_CUSTOM_ELEMENTS: string[] = [];

/** Default allowed custom element host patterns: none by default */
export const DEFAULT_ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS: string[] = [];

let activeAllowedElements: Set<string> = new Set(
  DEFAULT_ALLOWED_CUSTOM_ELEMENTS.map((el) => el.toLowerCase().trim()),
);

let activeHostPatterns: string[] = [
  ...DEFAULT_ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS,
];
let activeHostMatchers: Array<(hostname: string) => boolean> = [];

function rebuildHostMatchers(patterns: string[]): void {
  activeHostMatchers = patterns
    .map((p) => parseHostPatternMatch(p))
    .filter(Boolean);
}

rebuildHostMatchers(activeHostPatterns);

function normalizeElementList(elements: string[] | string): string[] {
  if (Array.isArray(elements)) {
    return elements
      .map((s) => (typeof s === "string" ? s.toLowerCase().trim() : ""))
      .filter(Boolean);
  }
  if (typeof elements === "string") {
    return elements
      .split(/[\n,]+/)
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizePatternList(patterns: string[] | string): string[] {
  if (Array.isArray(patterns)) {
    return patterns
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
  }
  if (typeof patterns === "string") {
    return patterns
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function setAllowedCustomElements(elements: string[] | string): void {
  const list = normalizeElementList(elements);
  activeAllowedElements = new Set(list);
}

export function getAllowedCustomElements(): string[] {
  return Array.from(activeAllowedElements);
}

export function setAllowedCustomElementHostPatterns(
  patterns: string[] | string,
): void {
  const list = normalizePatternList(patterns);
  activeHostPatterns = list;
  rebuildHostMatchers(list);
}

export function getAllowedCustomElementHostPatterns(): string[] {
  return [...activeHostPatterns];
}

export function isAllowedCustomElement(tagName: string): boolean {
  if (!tagName || typeof tagName !== "string") {
    return false;
  }

  const lower = tagName.trim().toLowerCase();

  // If not a custom element (no hyphen), allow standard HTML tag handling
  if (!lower.includes("-")) {
    return true;
  }

  // ShadowClaw core elements are built-in and always permitted
  if (
    lower === "shadow-claw" ||
    lower.startsWith("shadow-claw-") ||
    lower.startsWith("sc-")
  ) {
    return true;
  }

  // Check against explicit allowlist
  return activeAllowedElements.has(lower);
}

export function isSafeCustomElementSource(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") {
    return false;
  }

  const trimmed = urlStr.trim();
  if (!trimmed) {
    return false;
  }

  // Reject dangerous pseudo-protocols
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
    return false;
  }

  // Allow blob: URLs (used by internal web workers)
  if (/^blob:/i.test(trimmed)) {
    return true;
  }

  // Relative same-origin paths are trusted
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return true;
  }

  try {
    const base =
      typeof globalThis !== "undefined" &&
      globalThis.location?.origin &&
      globalThis.location.origin !== "null"
        ? globalThis.location.origin
        : "http://localhost";
    const url = new URL(trimmed, base);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    // Same-origin is trusted
    if (
      typeof globalThis !== "undefined" &&
      globalThis.location?.origin &&
      globalThis.location.origin !== "null" &&
      url.origin === globalThis.location.origin
    ) {
      return true;
    }

    const hostname = url.hostname.toLowerCase();

    return activeHostMatchers.some((matcher) => matcher(hostname));
  } catch {
    return false;
  }
}

export function configureCustomElementSecurity(config: {
  allowedCustomElements?: string[] | string;
  allowedCustomElementDomains?: string[] | string;
  customElements?:
    | {
        allowedElements?: string[] | string;
        allowedDomains?: string[] | string;
        scripts?: Array<string | { src: string }>;
      }
    | Array<string | { src: string }>;
}): void {
  if (!config || typeof config !== "object") {
    return;
  }

  const elements =
    config.allowedCustomElements ||
    (typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.allowedElements
      : undefined);

  if (elements !== undefined) {
    setAllowedCustomElements(elements);
  }

  const domains =
    config.allowedCustomElementDomains ||
    (typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.allowedDomains
      : undefined);

  if (domains !== undefined) {
    setAllowedCustomElementHostPatterns(domains);
  }
}

export type EmbeddedConfigHook = (config: any) => void;
let embeddedConfigHook: EmbeddedConfigHook | null = null;

export function setEmbeddedConfigHook(hook: EmbeddedConfigHook | null): void {
  embeddedConfigHook = hook;
}

export function initCustomElementSecurityFromEmbeddedConfig(): void {
  if (typeof document === "undefined") {
    return;
  }

  const configScript = document.getElementById("shadow-claw-site-config");
  if (configScript && configScript.textContent) {
    try {
      const config = JSON.parse(configScript.textContent);
      configureCustomElementSecurity(config);
      embeddedConfigHook?.(config);
    } catch {
      // ignore JSON parse error
    }
  }
}

let originalCustomElementsDefine: typeof customElements.define | null = null;
let isRegistryGuardInstalled = false;

export function installCustomElementsRegistryGuard(): void {
  initCustomElementSecurityFromEmbeddedConfig();

  if (
    isRegistryGuardInstalled ||
    typeof customElements === "undefined" ||
    typeof customElements.define !== "function"
  ) {
    return;
  }

  originalCustomElementsDefine = customElements.define.bind(customElements);

  customElements.define = function (
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions,
  ) {
    const lowerName = (name || "").toLowerCase().trim();
    if (!isAllowedCustomElement(lowerName)) {
      const errorMsg = `[Security] Registration blocked: <${name}> is not an approved custom element.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    return originalCustomElementsDefine!(name, constructor, options);
  };

  isRegistryGuardInstalled = true;
}

export function uninstallCustomElementsRegistryGuard(): void {
  if (!isRegistryGuardInstalled || !originalCustomElementsDefine) {
    return;
  }

  customElements.define = originalCustomElementsDefine;
  originalCustomElementsDefine = null;
  isRegistryGuardInstalled = false;
}

export function installCustomElementDomGuard(
  root: Node = typeof document !== "undefined"
    ? document.documentElement
    : (null as any),
): MutationObserver | null {
  if (typeof MutationObserver === "undefined" || !root) {
    return null;
  }

  // Sweep existing unapproved custom elements already present in root
  if (typeof (root as any).querySelectorAll === "function") {
    try {
      const existing = (root as Element).querySelectorAll("*");
      existing.forEach((el) => {
        const tagName = el.tagName ? el.tagName.toLowerCase() : "";
        if (tagName.includes("-") && !isAllowedCustomElement(tagName)) {
          console.warn(
            `[Security] Removing existing unapproved custom element: <${tagName}>`,
          );
          el.remove();
        }
      });
    } catch {}
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
          const el = node as Element;
          const tagName = el.tagName ? el.tagName.toLowerCase() : "";
          if (tagName.includes("-") && !isAllowedCustomElement(tagName)) {
            console.warn(
              `[Security] Removing unapproved custom element: <${tagName}>`,
            );
            el.remove();
          }
        }
      });
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return observer;
}
