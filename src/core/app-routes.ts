import {
  resolvePrettyPathToRoute,
  resolveRouteToPrettyPath,
  resolvePrettyPathToRouteAsync,
} from "../storage/staticRouting.js";

export type ShadowClawPageRoute =
  | "chat"
  | "files"
  | "tasks"
  | "pages"
  | "settings"
  | "tools"
  | "channels";

export interface ShadowClawAppRoute {
  page: ShadowClawPageRoute;
  groupId?: string;
  path?: string;
  anchor?: string;
}

function encodePathSegment(value: string): string {
  if (value === "br:main") {
    return "main";
  }
  if (value.startsWith("br:")) {
    return `br-${value.slice(3)}`;
  }

  return encodeURIComponent(value);
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

let cachedBasePath: string | null = null;

const VALID_PAGES = new Set([
  "chat",
  "files",
  "tasks",
  "pages",
  "settings",
  "tools",
  "channels",
]);

export function resetAppBasePathCache(): void {
  cachedBasePath = null;
}

if (typeof globalThis !== "undefined") {
  (globalThis as any).__applyBasePathCacheReset = resetAppBasePathCache;
}

export function getDeploymentNamespace(): string {
  const globalObj =
    typeof window !== "undefined"
      ? window
      : typeof self !== "undefined"
        ? self
        : globalThis;

  if (globalObj && (globalObj as any).__SHADOWCLAW_DEPLOY_ID__) {
    const customId = String((globalObj as any).__SHADOWCLAW_DEPLOY_ID__).trim();
    if (customId) {
      return customId.replace(/[^a-zA-Z0-9_-]/g, "-");
    }
  }

  const proc = (globalThis as any).process;
  if (proc && proc.env && proc.env.SHADOWCLAW_DEPLOY_ID) {
    const envId = String(proc.env.SHADOWCLAW_DEPLOY_ID).trim();
    if (envId) {
      return envId.replace(/[^a-zA-Z0-9_-]/g, "-");
    }
  }

  const basePath = getAppBasePath();
  if (!basePath || basePath === "/") {
    return "";
  }

  const clean = basePath.replace(/^\/+|\/+$/g, "");
  return clean.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function getAppBasePath(): string {
  if (cachedBasePath !== null) {
    return cachedBasePath;
  }

  // In Web Worker environment:
  const isWorker =
    typeof window === "undefined" ||
    (typeof (globalThis as any).WorkerGlobalScope !== "undefined" &&
      typeof self !== "undefined" &&
      self instanceof (globalThis as any).WorkerGlobalScope);

  if (isWorker && typeof self !== "undefined" && (self as any).location) {
    const workerPath = (self as any).location.pathname || "/";
    const parts = workerPath.split("/").filter(Boolean);

    // In a Web Worker, the pathname is always the URL of a script file (e.g. /agent.worker.js or /shadow-claw/agent.worker.js).
    // If there is only 1 segment (e.g. ["agent.worker.js"]), the worker is hosted at the root domain.
    if (parts.length <= 1) {
      cachedBasePath = "/";

      return cachedBasePath;
    }

    const first = parts[0].toLowerCase();
    const isRootFileOrDir =
      first === "service-worker.js" ||
      first === "sw.js" ||
      first === "manifest.json" ||
      first === "sitemap.xml" ||
      first === "favicon.ico" ||
      first === "index.html" ||
      first === "service-worker" ||
      first === "assets" ||
      first === "dist" ||
      first === "public";

    // If there are 2 segments and the first is an internal asset/service-worker folder (e.g. /service-worker/init.js),
    // it's hosted at the root domain.
    if (isRootFileOrDir && parts.length === 2) {
      cachedBasePath = "/";

      return cachedBasePath;
    }

    if (!isRootFileOrDir) {
      cachedBasePath = "/" + parts[0] + "/";

      return cachedBasePath;
    }
  }

  const loc =
    typeof window !== "undefined" && window.location
      ? window.location
      : typeof self !== "undefined" && self.location
        ? self.location
        : null;

  if (!loc) {
    return "/";
  }

  // 1. Check for explicit <base href="..."> element in the DOM
  if (
    typeof document !== "undefined" &&
    typeof document.querySelector === "function"
  ) {
    const baseEl = document.querySelector("base[href]");
    if (baseEl) {
      const href = baseEl.getAttribute("href");
      if (href) {
        try {
          const baseUriPath = new URL(href, loc.origin).pathname;
          let base = baseUriPath;
          if (!base.endsWith("/")) {
            base += "/";
          }
          cachedBasePath = base;

          return cachedBasePath;
        } catch {
          // ignore parsing error, fall through
        }
      }
    }
  }

  const pathname = loc.pathname || "/";
  if (pathname === "/") {
    cachedBasePath = "/";

    return cachedBasePath;
  }

  const parts = pathname.split("/").filter(Boolean);
  const pageIndex = parts.findIndex((part) =>
    VALID_PAGES.has(part.toLowerCase()),
  );

  if (pageIndex >= 0) {
    if (pageIndex === 0) {
      cachedBasePath = "/";

      return cachedBasePath;
    }

    cachedBasePath = "/" + parts.slice(0, pageIndex).join("/") + "/";

    return cachedBasePath;
  }

  // 2. Check if the current pathname is a known pretty route
  const prettyRoute = resolvePrettyPathToRoute(pathname);
  if (prettyRoute) {
    cachedBasePath = "/";

    return cachedBasePath;
  }

  // 3. Check for single-segment subpath deployments (e.g. /shadow-claw/ or /my-app/)
  if (parts.length === 1 && !pathname.includes(".")) {
    cachedBasePath = "/" + parts[0] + "/";

    return cachedBasePath;
  }

  // 4. Default to root base path for unhandled multi-segment paths
  cachedBasePath = "/";

  return cachedBasePath;
}

export function applyBasePath(path: string): string {
  const base = getAppBasePath();
  if (base === "/") {
    return path;
  }

  const [pathPart, ...rest] = path.split(/(?=[?#])/);

  // If the path already starts with the base, don't double-prefix.
  if (pathPart === base || pathPart.startsWith(base)) {
    return path;
  }

  const relative = pathPart.startsWith("/") ? pathPart.slice(1) : pathPart;

  let combined = base + relative;
  combined = combined.replace(/\/{2,}/g, "/");

  return combined + rest.join("");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeRouteGroupId(
  groupId: string | undefined,
): string | undefined {
  if (!groupId) {
    return groupId;
  }

  if (groupId === "main") {
    return "br:main";
  }

  // Accept browser-safe "br-..." route IDs and normalize to canonical "br:...".
  if (groupId.startsWith("br-")) {
    return `br:${groupId.slice(3)}`;
  }

  return groupId;
}

function sanitizeWorkspacePath(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const normalized = trimSlashes(path.replace(/\\/g, "/"));
  if (!normalized) {
    return undefined;
  }

  const parts = normalized
    .split("/")
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "..");

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("/");
}

export function buildRoutePath(route: ShadowClawAppRoute): string {
  const anchor = route.anchor ? `#${route.anchor.replace(/^#/, "")}` : "";

  const prettyPath = resolveRouteToPrettyPath(route);
  if (prettyPath) {
    let clean = prettyPath;
    if (!clean.startsWith("/")) {
      clean = `/${clean}`;
    }

    return `${clean}${anchor}`;
  }

  switch (route.page) {
    case "chat": {
      const path = route.groupId
        ? `/chat/${encodePathSegment(route.groupId)}/`
        : "/chat";

      return `${path}${anchor}`;
    }

    case "tasks": {
      const path = route.groupId
        ? `/tasks/${encodePathSegment(route.groupId)}/`
        : "/tasks";

      return `${path}${anchor}`;
    }

    case "files": {
      const workspacePath = sanitizeWorkspacePath(route.path);
      if (!route.groupId) {
        return `/files${anchor}`;
      }

      if (!workspacePath) {
        return `/files/${encodePathSegment(route.groupId)}/${anchor}`;
      }

      return `/files/${encodePathSegment(route.groupId)}/${workspacePath}${anchor}`;
    }

    case "pages": {
      const workspacePath = sanitizeWorkspacePath(route.path);
      if (!workspacePath) {
        return `/pages${anchor}`;
      }

      if (route.groupId) {
        return `/pages/${encodePathSegment(route.groupId)}/${workspacePath}${anchor}`;
      }

      return `/pages/${workspacePath}${anchor}`;
    }

    case "tools":
      return `/settings/tool-configuration${anchor}`;

    case "channels":
      return `/settings/channel-configuration${anchor}`;

    case "settings":
    default:
      return `/settings${anchor}`;
  }
}

export function parseRouteFromUrl(
  url: URL,
  fallbackGroupId?: string,
): ShadowClawAppRoute | null {
  let pathname = url.pathname;
  const basePath = getAppBasePath();

  if (basePath !== "/" && pathname.startsWith(basePath)) {
    pathname = "/" + pathname.slice(basePath.length);
  }

  const prettyRoute = resolvePrettyPathToRoute(pathname);
  if (prettyRoute) {
    const anchor = url.hash ? url.hash.replace(/^#/, "") : undefined;

    return {
      ...prettyRoute,
      anchor: anchor || prettyRoute.anchor,
    };
  }

  const parts = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodePathSegment(part));
  const anchor = url.hash ? url.hash.replace(/^#/, "") : undefined;

  if (parts.length === 0) {
    return null;
  }

  const page = parts[0].toLowerCase();

  if (page === "chat") {
    return {
      page: "chat",
      groupId: normalizeRouteGroupId(parts[1] || fallbackGroupId),
      anchor,
    };
  }

  if (page === "tasks") {
    return {
      page: "tasks",
      groupId: normalizeRouteGroupId(parts[1] || fallbackGroupId),
      anchor,
    };
  }

  if (page === "files") {
    const groupId = normalizeRouteGroupId(parts[1] || fallbackGroupId);
    const path = sanitizeWorkspacePath(parts.slice(2).join("/"));

    return {
      page: "files",
      groupId,
      path,
      anchor,
    };
  }

  if (page === "pages") {
    if (parts.length >= 3) {
      return {
        page: "pages",
        groupId: normalizeRouteGroupId(parts[1]),
        path: sanitizeWorkspacePath(parts.slice(2).join("/")),
        anchor,
      };
    }

    return {
      page: "pages",
      groupId: normalizeRouteGroupId(fallbackGroupId),
      path: sanitizeWorkspacePath(parts.slice(1).join("/")),
      anchor,
    };
  }

  if (page === "settings") {
    const section = (parts[1] || "").toLowerCase();
    if (section === "tool-configuration") {
      return { page: "tools", anchor };
    }

    if (section === "channel-configuration") {
      return { page: "channels", anchor };
    }

    return { page: "settings", anchor };
  }

  if (page === "tools") {
    return { page: "tools", anchor };
  }

  if (page === "channels") {
    return { page: "channels", anchor };
  }

  return null;
}

export function isPossibleAppRoute(pathname: string): boolean {
  let relativePath = pathname;
  const basePath = getAppBasePath();

  if (basePath !== "/" && relativePath.startsWith(basePath)) {
    relativePath = "/" + relativePath.slice(basePath.length);
  } else if (basePath !== "/" && !relativePath.startsWith(basePath)) {
    return false;
  }

  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length === 0) return true; // root

  const page = parts[0].toLowerCase();
  if (VALID_PAGES.has(page)) return true;

  if (resolvePrettyPathToRoute(relativePath)) return true;

  return false;
}

export async function parseRouteFromUrlAsync(
  url: URL,
  fallbackGroupId?: string,
): Promise<ShadowClawAppRoute | null> {
  const syncRoute = parseRouteFromUrl(url, fallbackGroupId);
  if (syncRoute) return syncRoute;

  let pathname = url.pathname;
  const basePath = getAppBasePath();
  if (basePath !== "/" && pathname.startsWith(basePath)) {
    pathname = "/" + pathname.slice(basePath.length);
  }

  const prettyRoute = await resolvePrettyPathToRouteAsync(pathname);
  if (prettyRoute) {
    const anchor = url.hash ? url.hash.replace(/^#/, "") : undefined;
    return {
      ...prettyRoute,
      anchor: anchor || prettyRoute.anchor,
    };
  }

  return null;
}

export function resolveHrefAgainstRoute(
  href: string,
  routePath: string,
  origin: string,
): URL | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("javascript:")) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    try {
      const resolvedPath = applyBasePath(trimmed);

      return new URL(resolvedPath, origin);
    } catch {
      return null;
    }
  }

  const base = new URL(routePath, origin);
  try {
    return new URL(trimmed, base);
  } catch {
    return null;
  }
}

export function getFileRouteDirPath(groupId: string, filePath: string): string {
  const normalized = sanitizeWorkspacePath(filePath);
  if (!normalized) {
    return buildRoutePath({ page: "files", groupId });
  }

  const parts = normalized.split("/");
  parts.pop();
  const prefix = parts.length > 0 ? `${parts.join("/")}/` : "";

  return `/files/${encodePathSegment(groupId)}/${prefix}`;
}

export function getWorkspaceRouteRequestPath(
  pathname: string,
): { groupId: string; path: string } | null {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodePathSegment(part));

  if (parts.length < 3) {
    return null;
  }

  if (parts[0] !== "files") {
    return null;
  }

  const groupId = normalizeRouteGroupId(parts[1]) || parts[1];
  const path = sanitizeWorkspacePath(parts.slice(2).join("/"));
  if (!groupId || !path) {
    return null;
  }

  return { groupId, path };
}
