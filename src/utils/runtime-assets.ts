import { applyBasePath } from "../core/app-routes.js";
import { toTrustedScriptUrl } from "../security/trusted-types.js";

let cachedAssetBase: string | null = null;

export function resetRuntimeAssetBaseCache(): void {
  cachedAssetBase = null;
}

/**
 * Returns the base URL from which static runtime assets (workers, iframe bridges, etc.)
 * should be loaded. Resolution precedence:
 * 1. `<meta name="shadow-claw-asset-base" content="...">`
 * 2. Embedded site-config (`runtime.assetBase` in `#shadow-claw-site-config`)
 * 3. Automatic inference from `import.meta.url` (when running from CDN / dist/lib)
 * 4. Application base path fallback (`applyBasePath("/")`)
 */
export function getRuntimeAssetBase(): string {
  if (cachedAssetBase !== null) {
    return cachedAssetBase;
  }

  // 1. Meta tag override
  if (typeof document !== "undefined") {
    const metaEl = document.querySelector<HTMLMetaElement>(
      'meta[name="shadow-claw-asset-base"]',
    );
    const content = metaEl?.getAttribute("content")?.trim();
    if (content) {
      cachedAssetBase = content.endsWith("/") ? content : `${content}/`;
      return cachedAssetBase;
    }

    // 2. Site config override
    const configScript = document.getElementById("shadow-claw-site-config");
    if (configScript?.textContent) {
      try {
        const config = JSON.parse(configScript.textContent);
        const configuredBase = config?.runtime?.assetBase;
        if (typeof configuredBase === "string" && configuredBase.trim()) {
          const trimmed = configuredBase.trim();
          cachedAssetBase = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
          return cachedAssetBase;
        }
      } catch {}
    }
  }

  // 3. Automatic detection from import.meta.url
  if (typeof import.meta !== "undefined" && import.meta.url) {
    const moduleUrl = import.meta.url;
    if (moduleUrl.startsWith("http://") || moduleUrl.startsWith("https://")) {
      try {
        if (moduleUrl.includes("/dist/lib/")) {
          cachedAssetBase = new URL("../public/", moduleUrl).href;
          return cachedAssetBase;
        }
        if (moduleUrl.includes("/dist/public/")) {
          cachedAssetBase = new URL("./", moduleUrl).href;
          return cachedAssetBase;
        }
      } catch {}
    }
  }

  // 4. Default fallback: applyBasePath("/") on current origin
  const basePath = applyBasePath("/");
  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      cachedAssetBase = new URL(basePath, window.location.origin).href;
      if (!cachedAssetBase.endsWith("/")) {
        cachedAssetBase += "/";
      }
      return cachedAssetBase;
    } catch {}
  }

  cachedAssetBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return cachedAssetBase;
}

/**
 * Resolves a runtime asset path (e.g. "assets/iframe-storage-bridge.js" or "agent.worker.js")
 * to its fully qualified runtime URL.
 */
export function resolveRuntimeAsset(assetPath: string): string {
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    if (assetPath.includes("/dist/lib/")) {
      return assetPath.replace("/dist/lib/", "/dist/public/");
    }
    return assetPath;
  }

  if (
    assetPath.startsWith("//") ||
    assetPath.startsWith("data:") ||
    assetPath.startsWith("blob:")
  ) {
    return assetPath;
  }

  const cleanPath = assetPath.replace(/^\/+/, "");
  const base = getRuntimeAssetBase();

  if (isCrossOriginAsset(base)) {
    try {
      return new URL(cleanPath, base).href;
    } catch {
      return `${base.replace(/\/+$/, "")}/${cleanPath}`;
    }
  }

  const appBase = applyBasePath("/");
  if (!assetPath.startsWith("/") && appBase === "/") {
    return cleanPath;
  }

  return applyBasePath(`/${cleanPath}`);
}

/**
 * Checks whether an asset URL is cross-origin compared to the active window location.
 */
export function isCrossOriginAsset(assetUrl: string): boolean {
  if (
    assetUrl.startsWith("data:") ||
    assetUrl.startsWith("blob:") ||
    assetUrl.startsWith("file:") ||
    assetUrl.startsWith("/")
  ) {
    return false;
  }

  if (typeof window === "undefined" || !window.location?.origin) {
    return false;
  }

  try {
    const url = new URL(assetUrl, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return Boolean(
      window.location.origin &&
      window.location.origin !== "null" &&
      url.origin !== window.location.origin,
    );
  } catch {
    return false;
  }
}

/**
 * Instantiates an ECMAScript module Worker safely across both same-origin and cross-origin
 * environments (e.g. CDN single-file deployments). If the target worker is cross-origin,
 * wraps the import in a Blob script URL.
 */
export function createModuleWorker(
  workerPathOrUrl: string,
  options: WorkerOptions = {},
): Worker {
  const resolvedUrl = resolveRuntimeAsset(workerPathOrUrl);

  if (isCrossOriginAsset(resolvedUrl)) {
    const blobContent = `import "${resolvedUrl}";`;
    const blob = new Blob([blobContent], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const trustedScriptUrl = toTrustedScriptUrl(blobUrl);

    return new Worker(trustedScriptUrl as string, {
      ...options,
      type: "module",
    });
  }

  const trustedScriptUrl = toTrustedScriptUrl(resolvedUrl);
  return new Worker(trustedScriptUrl as string, {
    ...options,
    type: "module",
  });
}
