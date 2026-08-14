/// <reference lib="dom" />
import { applyBasePath, type ShadowClawAppRoute } from "../core/app-routes.js";

export interface StaticRouteDefinition {
  prettyPath: string;
}

export interface StaticRoutesManifest {
  routes: Record<string, StaticRouteDefinition>;
  subRoutes?: string[] | Record<string, string>;
}

export const STATIC_ROUTING_SCRIPT_ID = "shadow-claw-static-routing";
export const STATIC_ROUTING_MANIFEST_PATH = "static-routing.json";

let cachedManifest: StaticRoutesManifest | null = null;

export function resolveStaticRoutingManifestUrl(): string {
  const targetPath = applyBasePath(`/${STATIC_ROUTING_MANIFEST_PATH}`);

  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      return new URL(targetPath, window.location.origin).toString();
    } catch {
      return targetPath;
    }
  }

  return targetPath;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizePrettyPathKey(path: string): string {
  let clean = trimSlashes(path);
  if (clean.endsWith("/index.html")) {
    clean = clean.slice(0, -"/index.html".length);
  } else if (clean.endsWith("index.html")) {
    clean = clean.slice(0, -"index.html".length);
  }
  return trimSlashes(clean);
}

function parseCanonicalRouteKey(
  canonicalKey: string,
): ShadowClawAppRoute | null {
  const normalizedKey = trimSlashes(canonicalKey);
  const parts = normalizedKey.split("/").filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const first = parts[0].toLowerCase();
  if (first === "pages") {
    if (parts.length >= 3) {
      const rawGroup = parts[1];
      const groupId =
        rawGroup === "main"
          ? "br:main"
          : rawGroup.startsWith("br-")
            ? `br:${rawGroup.slice(3)}`
            : rawGroup;
      const filePath = parts.slice(2).join("/");
      return {
        page: "pages",
        groupId,
        path: filePath,
      };
    }
    return {
      page: "pages",
      groupId: "br:main",
      path: parts.slice(1).join("/"),
    };
  }

  if (first === "files") {
    const rawGroup = parts[1] || "main";
    const groupId =
      rawGroup === "main"
        ? "br:main"
        : rawGroup.startsWith("br-")
          ? `br:${rawGroup.slice(3)}`
          : rawGroup;
    const filePath = parts.slice(2).join("/");
    return {
      page: "files",
      groupId,
      path: filePath || undefined,
    };
  }

  if (first === "chat") {
    const rawGroup = parts[1] || "main";
    const groupId =
      rawGroup === "main"
        ? "br:main"
        : rawGroup.startsWith("br-")
          ? `br:${rawGroup.slice(3)}`
          : rawGroup;
    return {
      page: "chat",
      groupId,
    };
  }

  if (first === "tasks") {
    const rawGroup = parts[1] || "main";
    const groupId =
      rawGroup === "main"
        ? "br:main"
        : rawGroup.startsWith("br-")
          ? `br:${rawGroup.slice(3)}`
          : rawGroup;
    return {
      page: "tasks",
      groupId,
    };
  }

  // If format is "posts/xyz.md" or "main/posts/xyz.md"
  if (first === "main") {
    return {
      page: "pages",
      groupId: "br:main",
      path: parts.slice(1).join("/"),
    };
  }

  return {
    page: "pages",
    groupId: "br:main",
    path: normalizedKey,
  };
}

export function getEmbeddedStaticRoutesManifest(): StaticRoutesManifest | null {
  if (typeof document !== "undefined") {
    const scriptEl = document.getElementById(STATIC_ROUTING_SCRIPT_ID);
    if (scriptEl && scriptEl.textContent) {
      try {
        const parsed = JSON.parse(scriptEl.textContent);
        if (parsed && typeof parsed === "object" && parsed.routes) {
          return parsed as StaticRoutesManifest;
        }
      } catch (err) {
        console.warn("Failed to parse embedded static routing manifest:", err);
      }
    }
  }
  return null;
}

export async function getStaticRoutingManifest(): Promise<StaticRoutesManifest> {
  if (cachedManifest) {
    return cachedManifest;
  }

  let baseManifest = getEmbeddedStaticRoutesManifest();
  const baseUrl = resolveStaticRoutingManifestUrl();

  if (!baseManifest) {
    if (typeof fetch === "function") {
      try {
        const res = await fetch(baseUrl);
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && typeof parsed === "object") {
            baseManifest = parsed as StaticRoutesManifest;
          }
        }
      } catch {
        // Fetch unavailable or failed
      }
    }
  }

  if (!baseManifest) {
    return { routes: {} };
  }

  if (!baseManifest.routes) {
    baseManifest.routes = {};
  }

  // Removed eager recursive fetch of subRoutes for CSR to support lazy loading
  // Subroutes will be fetched on demand via resolvePrettyPathToRouteAsync.

  cachedManifest = baseManifest;
  return cachedManifest;
}

export function setStaticRoutesManifest(
  manifest: StaticRoutesManifest | null,
): void {
  cachedManifest = manifest;
}

export function clearStaticRoutesManifestCache(): void {
  cachedManifest = null;
}

export function resolvePrettyPathToRoute(
  pathname: string,
  manifest?: StaticRoutesManifest | null,
): ShadowClawAppRoute | null {
  const routesManifest =
    manifest || cachedManifest || getEmbeddedStaticRoutesManifest();
  if (!routesManifest || !routesManifest.routes) {
    return null;
  }

  const normalizedPath = normalizePrettyPathKey(pathname);
  if (!normalizedPath) {
    return null;
  }

  for (const [canonicalKey, routeDef] of Object.entries(
    routesManifest.routes,
  )) {
    if (!routeDef || !routeDef.prettyPath) {
      continue;
    }

    const normalizedPretty = normalizePrettyPathKey(routeDef.prettyPath);
    if (normalizedPretty === normalizedPath) {
      return parseCanonicalRouteKey(canonicalKey);
    }
  }

  return null;
}

export async function resolvePrettyPathToRouteAsync(
  pathname: string,
): Promise<ShadowClawAppRoute | null> {
  const syncMatch = resolvePrettyPathToRoute(pathname);
  if (syncMatch) return syncMatch;

  const manifest = await getStaticRoutingManifest();
  if (!manifest || !manifest.subRoutes) return null;

  let currentManifest = manifest;
  let currentManifestUrl = resolveStaticRoutingManifestUrl();
  let maxDepth = 5;

  while (currentManifest && currentManifest.subRoutes && maxDepth > 0) {
    let matchedSubRouteUrl: string | null = null;
    const normalizedPath = normalizePrettyPathKey(pathname);

    if (Array.isArray(currentManifest.subRoutes)) {
      for (const sub of currentManifest.subRoutes) {
        let subDir = sub.replace(/\/routes\.json$/, "");
        if (normalizedPath.startsWith(subDir)) {
          matchedSubRouteUrl = sub;
          break;
        }
      }
    } else if (typeof currentManifest.subRoutes === "object") {
      let longestMatch = "";
      for (const [prefix, sub] of Object.entries(currentManifest.subRoutes)) {
        const normPrefix = normalizePrettyPathKey(prefix);
        if (
          normalizedPath.startsWith(normPrefix) &&
          normPrefix.length > longestMatch.length
        ) {
          longestMatch = normPrefix;
          matchedSubRouteUrl = sub;
        }
      }
    }

    if (!matchedSubRouteUrl || typeof fetch !== "function") {
      break;
    }

    try {
      let subUrl = matchedSubRouteUrl;
      try {
        if (
          matchedSubRouteUrl.startsWith("http://") ||
          matchedSubRouteUrl.startsWith("https://")
        ) {
          subUrl = matchedSubRouteUrl;
        } else if (matchedSubRouteUrl.startsWith("/")) {
          const withBase = applyBasePath(matchedSubRouteUrl);
          subUrl =
            typeof window !== "undefined" && window.location?.origin
              ? new URL(withBase, window.location.origin).toString()
              : withBase;
        } else {
          subUrl = new URL(matchedSubRouteUrl, currentManifestUrl).toString();
        }
      } catch {
        // Ignore
      }

      const res = await fetch(subUrl);
      if (!res.ok) break;

      const parsed = await res.json();
      if (!parsed || typeof parsed !== "object") break;

      if (parsed.routes) {
        Object.assign(manifest.routes, parsed.routes);
      }

      const found = resolvePrettyPathToRoute(pathname, manifest);
      if (found) return found;

      // Continue to next level if there are subRoutes
      currentManifest = parsed;
      currentManifestUrl = subUrl;
      maxDepth--;
    } catch (e) {
      console.warn("Failed to lazy load subRoute:", matchedSubRouteUrl, e);
      break;
    }
  }

  return null;
}

export function resolveRouteToPrettyPath(
  route: ShadowClawAppRoute,
  manifest?: StaticRoutesManifest | null,
): string | null {
  const routesManifest =
    manifest || cachedManifest || getEmbeddedStaticRoutesManifest();
  if (!routesManifest || !routesManifest.routes) {
    return null;
  }

  const { page, groupId, path } = route;
  if (!page) {
    return null;
  }

  const normalizedGroupId =
    groupId === "br:main" || groupId === "main"
      ? "main"
      : groupId?.startsWith("br:")
        ? `br-${groupId.slice(3)}`
        : groupId;

  const candidateKeys: string[] = [];
  if (page === "pages" && path) {
    const cleanPath = trimSlashes(path);
    if (normalizedGroupId === "main") {
      candidateKeys.push(`/pages/main/${cleanPath}`);
      candidateKeys.push(`pages/main/${cleanPath}`);
      candidateKeys.push(`/pages/br:main/${cleanPath}`);
      candidateKeys.push(`/pages/br-main/${cleanPath}`);
      candidateKeys.push(`/main/${cleanPath}`);
      candidateKeys.push(`main/${cleanPath}`);
      candidateKeys.push(`/${cleanPath}`);
      candidateKeys.push(cleanPath);
    } else if (normalizedGroupId) {
      candidateKeys.push(`/pages/${normalizedGroupId}/${cleanPath}`);
      candidateKeys.push(`pages/${normalizedGroupId}/${cleanPath}`);
      candidateKeys.push(`/pages/${groupId}/${cleanPath}`);
    }
  } else if (page === "files" && path) {
    const cleanPath = trimSlashes(path);
    if (normalizedGroupId) {
      candidateKeys.push(`/files/${normalizedGroupId}/${cleanPath}`);
      candidateKeys.push(`files/${normalizedGroupId}/${cleanPath}`);
      candidateKeys.push(`/files/${groupId}/${cleanPath}`);
    }
  }

  for (const candidate of candidateKeys) {
    const candidateNormalized = trimSlashes(candidate);
    for (const [canonicalKey, routeDef] of Object.entries(
      routesManifest.routes,
    )) {
      if (
        trimSlashes(canonicalKey) === candidateNormalized &&
        routeDef?.prettyPath
      ) {
        return routeDef.prettyPath;
      }
    }
  }

  return null;
}
