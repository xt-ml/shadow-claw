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

export function getAppBasePath(): string {
  if (cachedBasePath !== null) {
    return cachedBasePath;
  }

  if (typeof window === "undefined" || !window.location) {
    return "/";
  }

  if (document.baseURI) {
    const baseUriPath = new URL("", document.baseURI).pathname;
    if (baseUriPath !== "/") {
      cachedBasePath = baseUriPath;

      return cachedBasePath;
    }
  }

  const pathname = window.location.pathname;
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

  if (pathname === "/") {
    cachedBasePath = "/";

    return cachedBasePath;
  }

  let base = pathname;
  if (!base.endsWith("/")) {
    base += "/";
  }

  cachedBasePath = base;

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

  const groupId = parts[1];
  const path = sanitizeWorkspacePath(parts.slice(2).join("/"));
  if (!groupId || !path) {
    return null;
  }

  return { groupId, path };
}
