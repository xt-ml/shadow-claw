import { CONFIG_KEYS } from "../config/config.js";
import { getDb } from "../db/db.js";
import { getConfig } from "../db/getConfig.js";
import { getDOMPurify, parseHostPatternMatch } from "./iframe-sanitizer.js";
import { toTrustedScriptUrl } from "./trusted-types.js";

import type { Config } from "dompurify";
import type { ShadowClawDatabase } from "../db/types.js";

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

/**
 * Normalizes an element tag name or list into an array of lowercase strings.
 */
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

/**
 * Normalizes a list of host patterns into an array of trimmed strings.
 */
function normalizePatternList(patterns: string[] | string): string[] {
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

/**
 * Set the allowed custom elements in memory.
 */
export function setAllowedCustomElements(elements: string[] | string): void {
  const list = normalizeElementList(elements);
  activeAllowedElements = new Set(list);
}

/**
 * Get the current list of allowed custom elements.
 */
export function getAllowedCustomElements(): string[] {
  return Array.from(activeAllowedElements);
}

/**
 * Set the allowed custom element host patterns in memory.
 */
export function setAllowedCustomElementHostPatterns(
  patterns: string[] | string,
): void {
  const list = normalizePatternList(patterns);
  activeHostPatterns = list;
  rebuildHostMatchers(list);
}

/**
 * Get the current list of allowed custom element host patterns.
 */
export function getAllowedCustomElementHostPatterns(): string[] {
  return [...activeHostPatterns];
}

/**
 * Check if a custom element tag name is approved.
 * Built-in ShadowClaw elements ("shadow-claw" and "shadow-claw-*") are always allowed.
 * Standard non-hyphenated HTML elements pass tag name check.
 */
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
  if (lower === "shadow-claw" || lower.startsWith("shadow-claw-")) {
    return true;
  }

  // Check against explicit allowlist
  return activeAllowedElements.has(lower);
}

/**
 * Check if a script URL source is from an approved domain or same-origin.
 */
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

export const DEFAULT_IFRAME_SANDBOX_POLICY =
  "allow-modals allow-scripts allow-popups allow-popups-to-escape-sandbox";

export const DEFAULT_WORKER_SRC = ["'self'", "blob:", "data:"];
export const DEFAULT_CONNECT_SRC = ["'self'", "blob:", "data:"];
export const DEFAULT_STYLE_SRC = [
  "'self'",
  "'unsafe-inline'",
  "https:",
  "http:",
];
export const DEFAULT_IMG_SRC = ["'self'", "blob:", "data:", "https:", "http:"];

let activeIframeSandboxPolicy: string = DEFAULT_IFRAME_SANDBOX_POLICY;
let activeWorkerSrc: string[] = [...DEFAULT_WORKER_SRC];
let activeConnectSrc: string[] = [...DEFAULT_CONNECT_SRC];
let activeScriptSrc: string[] = [];
let activeStyleSrc: string[] = [...DEFAULT_STYLE_SRC];
let activeImgSrc: string[] = [...DEFAULT_IMG_SRC];

/**
 * Get the active iframe sandbox policy string.
 */
export function getIframeSandboxPolicy(): string {
  return activeIframeSandboxPolicy;
}

/**
 * Set the iframe sandbox policy.
 */
export function setIframeSandboxPolicy(policy: string[] | string): void {
  if (Array.isArray(policy)) {
    activeIframeSandboxPolicy = policy
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .join(" ");
  } else if (typeof policy === "string" && policy.trim()) {
    activeIframeSandboxPolicy = policy.trim();
  } else {
    activeIframeSandboxPolicy = DEFAULT_IFRAME_SANDBOX_POLICY;
  }
}

/**
 * Generate CSP header string for the sandboxed preview iframe.
 */
export function getIframeCsp(nonce: string): string {
  const allowedPatterns = getAllowedCustomElementHostPatterns();
  const approvedScripts = getApprovedCustomElementScripts();

  const allowedScriptHosts = new Set<string>();
  for (const pattern of allowedPatterns) {
    if (pattern && /^(\*\.)?[a-zA-Z0-9.-]+(?::[0-9]+)?$/.test(pattern)) {
      allowedScriptHosts.add(`https://${pattern}`);
      allowedScriptHosts.add(`http://${pattern}`);
    }
  }
  for (const scriptUrl of approvedScripts) {
    try {
      const parsed = new URL(
        scriptUrl,
        typeof globalThis !== "undefined" && globalThis.location?.origin
          ? globalThis.location.origin
          : "http://localhost",
      );
      allowedScriptHosts.add(parsed.origin);
    } catch {}
  }

  const scriptSources = [
    `'nonce-${nonce}'`,
    ...Array.from(allowedScriptHosts),
    ...activeScriptSrc,
  ];

  const connectSources = [
    ...activeConnectSrc,
    ...Array.from(allowedScriptHosts),
  ];

  const directives: string[] = [
    `script-src ${Array.from(new Set(scriptSources)).join(" ")}`,
    `worker-src ${Array.from(new Set(activeWorkerSrc)).join(" ")}`,
    `connect-src ${Array.from(new Set(connectSources)).join(" ")}`,
    `style-src ${Array.from(new Set(activeStyleSrc)).join(" ")}`,
    `img-src ${Array.from(new Set(activeImgSrc)).join(" ")}`,
  ];

  return directives.join("; ");
}

/**
 * Configure custom element security and iframe sandbox policy from a site config object or options.
 */
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
  security?: {
    iframeSandbox?: string[] | string;
    allowSameOrigin?: boolean;
    allowIframeSameOrigin?: boolean;
    workerSrc?: string[] | string;
    connectSrc?: string[] | string;
    scriptSrc?: string[] | string;
    styleSrc?: string[] | string;
    imgSrc?: string[] | string;
  };
}): void {
  if (!config || typeof config !== "object") {
    return;
  }

  // Extract allowed elements
  const elements =
    config.allowedCustomElements ||
    (typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.allowedElements
      : undefined);

  if (elements !== undefined) {
    setAllowedCustomElements(elements);
  }

  // Extract allowed domains
  const domains =
    config.allowedCustomElementDomains ||
    (typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.allowedDomains
      : undefined);

  if (domains !== undefined) {
    setAllowedCustomElementHostPatterns(domains);
  }

  // Extract security iframe sandbox settings
  if (config.security?.iframeSandbox !== undefined) {
    setIframeSandboxPolicy(config.security.iframeSandbox);
  } else if (
    config.security?.allowSameOrigin === true ||
    config.security?.allowIframeSameOrigin === true
  ) {
    if (!activeIframeSandboxPolicy.includes("allow-same-origin")) {
      activeIframeSandboxPolicy =
        `${activeIframeSandboxPolicy} allow-same-origin`.trim();
    }
  }

  // Extract CSP overrides if configured
  if (config.security?.workerSrc !== undefined) {
    activeWorkerSrc = normalizePatternList(config.security.workerSrc);
  }
  if (config.security?.connectSrc !== undefined) {
    activeConnectSrc = normalizePatternList(config.security.connectSrc);
  }
  if (config.security?.scriptSrc !== undefined) {
    activeScriptSrc = normalizePatternList(config.security.scriptSrc);
  }
  if (config.security?.styleSrc !== undefined) {
    activeStyleSrc = normalizePatternList(config.security.styleSrc);
  }
  if (config.security?.imgSrc !== undefined) {
    activeImgSrc = normalizePatternList(config.security.imgSrc);
  }
}

/**
 * Initializes custom element security synchronously from embedded site-config script in the DOM if available.
 */
export function initCustomElementSecurityFromEmbeddedConfig(): void {
  if (typeof document === "undefined") {
    return;
  }

  const configScript = document.getElementById("shadow-claw-site-config");
  if (configScript && configScript.textContent) {
    try {
      const config = JSON.parse(configScript.textContent);
      configureCustomElementSecurity(config);
    } catch {
      // ignore JSON parse error
    }
  }
}

export interface CustomElementScriptDescriptor {
  src: string;
  hasInit: boolean;
}

/**
 * Retrieve approved custom element script descriptors from the embedded site config.
 */
export function getApprovedCustomElementScriptDescriptors(): CustomElementScriptDescriptor[] {
  if (typeof document === "undefined") {
    return [];
  }

  const configScript = document.getElementById("shadow-claw-site-config");
  if (!configScript || !configScript.textContent) {
    return [];
  }

  try {
    const config = JSON.parse(configScript.textContent);
    const scripts =
      typeof config.customElements === "object" &&
      !Array.isArray(config.customElements)
        ? config.customElements?.scripts
        : undefined;

    if (Array.isArray(scripts)) {
      return scripts
        .map((s: any) => {
          const src = typeof s === "string" ? s : s?.src;
          const hasInit =
            typeof s === "object" && s !== null ? Boolean(s.hasInit) : false;
          return { src, hasInit };
        })
        .filter(
          (entry): entry is CustomElementScriptDescriptor =>
            typeof entry.src === "string" &&
            isSafeCustomElementSource(entry.src),
        );
    }
  } catch {}

  return [];
}

/**
 * Retrieve approved custom element script URLs from the embedded site config.
 */
export function getApprovedCustomElementScripts(): string[] {
  return getApprovedCustomElementScriptDescriptors().map((d) => d.src);
}

/**
 * Load allowed custom elements and host patterns from IndexedDB.
 */
export async function loadCustomElementSecurityFromDb(
  db?: ShadowClawDatabase | null,
): Promise<void> {
  try {
    const database = db ?? (await getDb());
    if (!database) {
      return;
    }

    const [elementsVal, hostsVal] = await Promise.all([
      getConfig(database, CONFIG_KEYS.ALLOWED_CUSTOM_ELEMENTS),
      getConfig(database, CONFIG_KEYS.ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS),
    ]);

    if (typeof elementsVal === "string" && elementsVal.trim()) {
      try {
        const parsed = JSON.parse(elementsVal);
        setAllowedCustomElements(parsed);
      } catch {
        setAllowedCustomElements(elementsVal);
      }
    }

    if (typeof hostsVal === "string" && hostsVal.trim()) {
      try {
        const parsed = JSON.parse(hostsVal);
        setAllowedCustomElementHostPatterns(parsed);
      } catch {
        setAllowedCustomElementHostPatterns(hostsVal);
      }
    }
  } catch (err) {
    console.warn("Failed to load custom element security from db:", err);
  }
}

let originalCustomElementsDefine: typeof customElements.define | null = null;
let isRegistryGuardInstalled = false;

/**
 * Monkey-patches customElements.define to prevent registration of unapproved custom elements.
 */
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

/**
 * Restores the original customElements.define (useful for testing).
 */
export function uninstallCustomElementsRegistryGuard(): void {
  if (!isRegistryGuardInstalled || !originalCustomElementsDefine) {
    return;
  }

  customElements.define = originalCustomElementsDefine;
  originalCustomElementsDefine = null;
  isRegistryGuardInstalled = false;
}

/**
 * Installs a MutationObserver on a DOM tree to detect and strip unapproved custom elements.
 */
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

  observer.observe(root, { childList: true, subtree: true });

  return observer;
}

/**
 * Load an approved custom element script module dynamically.
 * Enforces domain validation and Trusted Types.
 */
export async function loadApprovedCustomElementScript(
  src: string,
  options: {
    type?: string;
    async?: boolean;
    defer?: boolean;
  } = {},
): Promise<HTMLScriptElement> {
  if (!isSafeCustomElementSource(src)) {
    throw new Error(
      `[Security] Refused to load script from unapproved host: ${src}`,
    );
  }

  if (typeof document === "undefined") {
    throw new Error("Cannot load script outside browser document environment.");
  }

  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript instanceof HTMLScriptElement) {
    return existingScript;
  }

  const trustedUrl = toTrustedScriptUrl(src) as string;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = options.type || "module";
    if (options.async) script.async = true;
    if (options.defer) script.defer = true;
    script.src = trustedUrl;

    script.onload = () => resolve(script);
    script.onerror = (err) =>
      reject(
        new Error(`Failed to load custom element script: ${src} (${err})`),
      );

    document.head.appendChild(script);
  });
}

let purifyHookRegistered = false;

/**
 * Ensures DOMPurify has the custom element sanitization hook registered.
 */
export function ensureCustomElementSanitizerHook(): void {
  if (purifyHookRegistered) {
    return;
  }

  const purify = getDOMPurify();

  if (purify && typeof purify.addHook === "function") {
    const sanitizeCustomElementNode = (node: Node) => {
      if (node && node.nodeType === 1 /* ELEMENT_NODE */) {
        const el = node as Element;
        const tagName = (el.tagName || "").toLowerCase();
        if (tagName.includes("-") && !isAllowedCustomElement(tagName)) {
          if (typeof el.remove === "function") {
            el.remove();
          }
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        }
      }
    };

    purify.addHook("uponSanitizeElement", sanitizeCustomElementNode);
    purify.addHook("afterSanitizeElements", sanitizeCustomElementNode);
    purifyHookRegistered = true;
  }
}

/**
 * Get DOMPurify configuration for custom element handling.
 */
export function getCustomElementPurifyConfig(): Config {
  ensureCustomElementSanitizerHook();

  return {
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: (tagName: string) => isAllowedCustomElement(tagName),
      attributeNameCheck: () => true,
      allowCustomizedBuiltInElements: false,
    },
  };
}
