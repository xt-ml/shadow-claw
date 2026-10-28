export * from "./custom-element-guard.js";

import {
  getAllowedCustomElementHostPatterns,
  getAllowedCustomElements,
  isAllowedCustomElement,
  isSafeCustomElementSource,
  normalizePatternList,
  setAllowedCustomElementHostPatterns,
  setAllowedCustomElements,
  setEmbeddedConfigHook,
} from "./custom-element-guard.js";

import { getDOMPurify } from "./iframe-sanitizer.js";
import { toTrustedScriptUrl } from "./trusted-types.js";
import {
  getRuntimeAssetBase,
  isCrossOriginAsset,
} from "../utils/runtime-assets.js";

import type { Config } from "dompurify";
import type { ShadowClawDatabase } from "../db/types.js";

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

  const assetBase = getRuntimeAssetBase();
  if (isCrossOriginAsset(assetBase)) {
    try {
      const parsedBase = new URL(assetBase);
      allowedScriptHosts.add(parsedBase.origin);
    } catch {}
  }

  const hasUnsafeInline = activeScriptSrc.includes("'unsafe-inline'");
  const scriptSources = [
    ...(hasUnsafeInline ? [] : [`'nonce-${nonce}'`]),
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

  // Extract custom element scripts
  const scripts =
    typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.scripts
      : undefined;

  if (scripts !== undefined) {
    setApprovedCustomElementScripts(scripts);
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

setEmbeddedConfigHook(configureCustomElementSecurity);

export interface CustomElementScriptDescriptor {
  src: string;
  id?: string;
  name?: string;
  global?: boolean;
  autoload?: boolean;
  type?: string;
  async?: boolean;
  defer?: boolean;
  hasInit: boolean;
}

let activeApprovedScripts: CustomElementScriptDescriptor[] = [];

/**
 * Set approved custom element scripts in memory.
 */
export function setApprovedCustomElementScripts(
  scripts: Array<string | Partial<CustomElementScriptDescriptor> | any>,
): void {
  if (Array.isArray(scripts)) {
    activeApprovedScripts = scripts
      .map((s: any) => {
        const src = typeof s === "string" ? s : s?.src;
        const id =
          typeof s === "object" && s !== null && typeof s.id === "string"
            ? s.id.trim()
            : undefined;
        const name =
          typeof s === "object" && s !== null && typeof s.name === "string"
            ? s.name.trim()
            : undefined;
        const global =
          typeof s === "object" && s !== null
            ? Boolean(s.global || s.autoload)
            : false;
        const type =
          typeof s === "object" && s !== null && typeof s.type === "string"
            ? s.type
            : undefined;
        const async =
          typeof s === "object" && s !== null && typeof s.async === "boolean"
            ? s.async
            : undefined;
        const defer =
          typeof s === "object" && s !== null && typeof s.defer === "boolean"
            ? s.defer
            : undefined;
        const hasInit =
          typeof s === "object" && s !== null ? Boolean(s.hasInit) : false;

        const descriptor: CustomElementScriptDescriptor = {
          src,
          ...(id ? { id } : {}),
          ...(name ? { name } : {}),
          ...(global ? { global: true, autoload: true } : {}),
          ...(type ? { type } : {}),
          ...(async ? { async } : {}),
          ...(defer ? { defer } : {}),
          hasInit,
        };
        return descriptor;
      })
      .filter(
        (entry): entry is CustomElementScriptDescriptor =>
          typeof entry.src === "string" && isSafeCustomElementSource(entry.src),
      );
  } else {
    activeApprovedScripts = [];
  }
}

/**
 * Retrieve approved custom element script descriptors from memory or embedded site config.
 */
export function getApprovedCustomElementScriptDescriptors(): CustomElementScriptDescriptor[] {
  if (activeApprovedScripts.length > 0) {
    return [...activeApprovedScripts];
  }

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
      setApprovedCustomElementScripts(scripts);
      return [...activeApprovedScripts];
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
 * Check if a script source URL is an approved custom element script.
 */
export function isApprovedScript(src: string): boolean {
  if (!src || typeof src !== "string") {
    return false;
  }

  const trimmed = src.trim();
  if (!trimmed) {
    return false;
  }

  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
    return false;
  }

  const descriptors = getApprovedCustomElementScriptDescriptors();
  if (descriptors.length === 0) {
    return false;
  }

  const trimmedLower = trimmed.toLowerCase();
  const matchByIdOrName = descriptors.some(
    (d) =>
      (d.id && d.id.toLowerCase() === trimmedLower) ||
      (d.name && d.name.toLowerCase() === trimmedLower),
  );
  if (matchByIdOrName) {
    return true;
  }

  const matchByStemOrFilename = descriptors.some((d) => {
    const base = (d.src.split("/").pop() || "").toLowerCase();
    const stem = base.replace(/\.(js|mjs|cjs|ts)$/i, "");
    return base === trimmedLower || stem === trimmedLower;
  });
  if (matchByStemOrFilename) {
    return true;
  }

  const approved = getApprovedCustomElementScripts();

  const clean = trimmed.split("?")[0].split("#")[0].trim();
  const stripPrefix = (s: string) =>
    s
      .replace(/^\.?\//, "")
      .replace(/^pages\/main\//, "")
      .toLowerCase();
  const normClean = stripPrefix(clean);

  return approved.some((app) => {
    if (app === clean) return true;
    if (stripPrefix(app) === normClean) return true;
    try {
      const urlTarget = new URL(trimmed, "http://localhost");
      const urlApp = new URL(app, "http://localhost");
      return (
        urlTarget.pathname.toLowerCase() === urlApp.pathname.toLowerCase() ||
        stripPrefix(urlTarget.pathname) === stripPrefix(urlApp.pathname)
      );
    } catch {
      return false;
    }
  });
}

/**
 * Check if HTML content contains any approved custom element tags.
 */
export function hasApprovedCustomElement(html: string): boolean {
  if (!html || typeof html !== "string") {
    return false;
  }
  const allowed = getAllowedCustomElements();
  if (allowed.length > 0) {
    return allowed.some((tag) => {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`<${escaped}[\\s>/]`, "i");
      return regex.test(html);
    });
  }

  // If no explicit allowed elements are set, check for any non-shadow-claw custom element
  const customTagRegex = /<([a-z][a-z0-9_]*-[a-z0-9_-]*)[\\s>/]/gi;
  let match: RegExpExecArray | null;
  while ((match = customTagRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    if (!tagName.startsWith("shadow-claw")) {
      return true;
    }
  }
  return false;
}

/**
 * Load allowed custom elements and host patterns from IndexedDB.
 */
export async function loadCustomElementSecurityFromDb(
  db?: ShadowClawDatabase | null,
): Promise<void> {
  try {
    const { getDb } = await import("../db/db.js");
    const { getConfig } = await import("../db/get-config.js");
    const database = db ?? (await getDb());
    if (!database) {
      return;
    }

    const [elementsVal, hostsVal] = await Promise.all([
      getConfig(database, "allowed_custom_elements"),
      getConfig(database, "allowed_custom_element_host_patterns"),
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
        } else if (tagName === "script") {
          const src = el.getAttribute("src") || "";
          if (!src || !isApprovedScript(src)) {
            if (typeof el.remove === "function") {
              el.remove();
            }
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
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
