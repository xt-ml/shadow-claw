/// <reference types="@types/serviceworker" />

import {
  applyBasePath,
  getDeploymentNamespace,
  getWorkspaceRouteRequestPath,
  isPossibleAppRoute,
} from "../core/app-routes.js";
import { shouldBypassFetchProxy } from "./fetch-proxy-rules.js";

import { getMimeType } from "../utils/mime.js";

/**
 * Intercept cross-origin requests and proxy them through the local /proxy endpoint
 * to circumvent CORS restrictions for the agent worker's fetch_url tool.
 */
let useProxy = false;
let proxyUrl = "/proxy";

function mimeTypeFromPath(path: string): string {
  const mime = getMimeType(path, "application/octet-stream")!;
  if (
    mime.startsWith("text/") ||
    mime === "application/javascript" ||
    mime === "application/json"
  ) {
    return `${mime}; charset=utf-8`;
  }

  return mime;
}

function shouldServeWorkspaceRouteRequest(request: Request): boolean {
  if (request.method !== "GET") {
    return false;
  }

  if (request.mode === "navigate") {
    return false;
  }

  if (request.destination === "document") {
    return false;
  }

  return true;
}

async function openWorkspaceRouteFile(
  groupId: string,
  workspacePath: string,
): Promise<File | null> {
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage || typeof storage.getDirectory !== "function") {
    return null;
  }

  try {
    const root = await storage.getDirectory();
    const ns = getDeploymentNamespace();
    const opfsRootName = ns ? `shadowclaw-${ns}` : "shadowclaw";
    const appRoot = await root.getDirectoryHandle(opfsRootName, {
      create: true,
    });
    const groupsDir = await appRoot.getDirectoryHandle("groups", {
      create: true,
    });
    const safeGroupId = groupId.replace(/:/g, "-");
    const groupDir = await groupsDir.getDirectoryHandle(safeGroupId, {
      create: false,
    });

    // Files are stored directly in the group directory (no workspace/ subdir)
    const parts = workspacePath.split("/").filter(Boolean);
    if (parts.length === 0) {
      return null;
    }

    const fileName = parts.pop();
    if (!fileName) {
      return null;
    }

    let current = groupDir;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: false });
    }

    const fileHandle = await current.getFileHandle(fileName, {
      create: false,
    });

    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

async function respondWithWorkspaceRouteFile(
  request: Request,
): Promise<Response | null> {
  const requestUrl = new URL(request.url);
  const target = getWorkspaceRouteRequestPath(requestUrl.pathname);
  if (!target) {
    return null;
  }

  if (!shouldServeWorkspaceRouteRequest(request)) {
    return null;
  }

  try {
    const file = await openWorkspaceRouteFile(target.groupId, target.path);
    if (!file) {
      return null;
    }

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": file.type || mimeTypeFromPath(target.path),
        "Content-Length": String(file.size),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return null;
  }
}

function isNavigationRequest(request: Request): boolean {
  return request.mode === "navigate" || request.destination === "document";
}

function ensureOriginAgentClusterHeader(response: Response): Response {
  if (
    response.type === "opaqueredirect" ||
    response.status === 0 ||
    (response.status >= 300 && response.status < 400)
  ) {
    return response;
  }

  if (response.headers.get("Origin-Agent-Cluster")) {
    return response;
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  headers["Origin-Agent-Cluster"] = "?1";

  const body = (response as any).body ?? (response as any)._bodySource;

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// GitHub Pages (and other static hosts) cannot send the Origin-Agent-Cluster
// response header, which Firefox requires to origin-isolate the page (Chrome
// isolates HTTPS origins automatically). Once this service worker controls
// the page, inject the header on same-origin navigations so the *next*
// top-level navigation is origin-keyed and @mcp-b/webmcp-polyfill can
// register tools. See src/service-worker/init.ts for the one-time reload
// that lets the very first, uncontrolled navigation pick this up.
async function matchCacheEntry(
  urlOrRequest: string | Request,
  options: { ignoreSearch?: boolean } = { ignoreSearch: true },
): Promise<Response | undefined> {
  if (typeof caches === "undefined") {
    return undefined;
  }

  // Search Workbox precache caches before runtime caches (e.g. shadow-claw-cache)
  // so updated deployments take precedence over older runtime-cached HTML.
  if (typeof caches.keys === "function") {
    try {
      const keys = await caches.keys();
      const sortedKeys = [...keys].sort((a, b) => {
        const aPrecache = a.startsWith("workbox-precache") ? 0 : 1;
        const bPrecache = b.startsWith("workbox-precache") ? 0 : 1;

        return aPrecache - bPrecache;
      });
      for (const key of sortedKeys) {
        const cache = await caches.open(key);
        const match = await cache.match(urlOrRequest, options);
        if (match) {
          return match;
        }
      }
    } catch {}
  }

  try {
    const directMatch = await caches.match(urlOrRequest, options);
    if (directMatch) {
      return directMatch;
    }
  } catch {}

  return undefined;
}

async function matchPrecacheOnlyEntry(
  urlOrRequest: string | Request,
  options: { ignoreSearch?: boolean } = { ignoreSearch: true },
): Promise<Response | undefined> {
  if (typeof caches === "undefined" || typeof caches.keys !== "function") {
    return undefined;
  }

  try {
    const keys = await caches.keys();
    for (const key of keys) {
      if (!key.startsWith("workbox-precache")) {
        continue;
      }
      const cache = await caches.open(key);
      const match = await cache.match(urlOrRequest, options);
      if (match) {
        return match;
      }
    }
  } catch {}

  return undefined;
}

async function matchFirstEntry(
  candidates: string[],
  matcher: (
    urlOrRequest: string | Request,
    options?: { ignoreSearch?: boolean },
  ) => Promise<Response | undefined>,
  options: { ignoreSearch?: boolean } = { ignoreSearch: true },
): Promise<Response | undefined> {
  for (const candidate of candidates) {
    const match = await matcher(candidate, options);
    if (match) {
      return match;
    }
  }

  return undefined;
}

async function matchFirstCachedCandidate(
  candidates: string[],
): Promise<Response | undefined> {
  return matchFirstEntry(candidates, matchCacheEntry, { ignoreSearch: true });
}

function getAppShellCandidates(): {
  shellPath: string;
  shellUrl: URL;
  candidates: string[];
} {
  const shellPath = applyBasePath("index.html");
  const shellUrl = new URL(shellPath, location.origin);

  return {
    shellPath,
    shellUrl,
    candidates: [
      shellUrl.href,
      shellPath,
      "index.html",
      "/index.html",
      "/",
      `${location.origin}/`,
    ],
  };
}

async function findPrecachedAppShell(): Promise<Response | undefined> {
  const { shellPath, shellUrl, candidates } = getAppShellCandidates();
  const rawRevision = (self as any).__SHADOWCLAW_PRECACHE_INDEX_REVISION__;
  const activeIndexRevision =
    typeof rawRevision === "string" ? rawRevision.trim() : "";

  if (activeIndexRevision) {
    const exactMatch = await matchFirstEntry(
      [
        `${shellUrl.href}?__WB_REVISION__=${activeIndexRevision}`,
        `${shellPath}?__WB_REVISION__=${activeIndexRevision}`,
      ],
      matchPrecacheOnlyEntry,
      { ignoreSearch: false },
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  return matchFirstEntry(candidates, matchPrecacheOnlyEntry, {
    ignoreSearch: true,
  });
}

async function findCachedAppShell(): Promise<Response | undefined> {
  const { candidates } = getAppShellCandidates();

  return matchFirstCachedCandidate(candidates);
}

async function findCachedNavigationCandidate(
  requestUrl: URL,
): Promise<Response | undefined> {
  const pathname = requestUrl.pathname;
  const cleanPath = pathname.replace(/\/+$/, "");

  return matchFirstCachedCandidate([
    requestUrl.href,
    pathname,
    `${cleanPath}/`,
    `${cleanPath}/index.html`,
    `${cleanPath}.html`,
  ]);
}

async function fetchWithOriginAgentCluster(
  request: Request,
): Promise<Response> {
  let response: Response;
  if (isNavigationRequest(request)) {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      credentials: request.credentials,
      redirect: "follow",
    });
  } else {
    response = await fetch(request);
  }

  if (response && response.ok && typeof caches !== "undefined") {
    try {
      const cache = await caches.open("shadow-claw-cache");
      await cache.put(request.url, response.clone());
    } catch {}
  }

  return ensureOriginAgentClusterHeader(response);
}

async function fetchAppShellWithOriginAgentCluster(): Promise<Response> {
  try {
    const precached = await findPrecachedAppShell();
    if (precached) {
      return ensureOriginAgentClusterHeader(precached);
    }
  } catch {}

  const { shellUrl } = getAppShellCandidates();

  let response: Response | undefined;
  try {
    const networkResponse = await fetch(shellUrl.href);
    if (networkResponse && networkResponse.ok) {
      response = networkResponse;
      if (typeof caches !== "undefined") {
        try {
          const cache = await caches.open("shadow-claw-cache");
          await cache.put(shellUrl.href, networkResponse.clone());
        } catch {}
      }
    } else {
      try {
        response = await findCachedAppShell();
      } catch {}
      if (!response) {
        response = networkResponse;
      }
    }
  } catch (err) {
    try {
      response = await findCachedAppShell();
    } catch {}
    if (!response) {
      throw err;
    }
  }

  return ensureOriginAgentClusterHeader(response);
}

async function fetchNavigationWithFallback(
  request: Request,
  requestUrl: URL,
): Promise<Response> {
  try {
    const networkResponse = await fetchWithOriginAgentCluster(request);
    if (
      networkResponse.ok ||
      networkResponse.type === "opaqueredirect" ||
      networkResponse.status === 0 ||
      (networkResponse.status >= 300 && networkResponse.status < 400)
    ) {
      return networkResponse;
    }

    const cachedCandidate = await findCachedNavigationCandidate(requestUrl);
    if (cachedCandidate) {
      return ensureOriginAgentClusterHeader(cachedCandidate);
    }

    return networkResponse;
  } catch (fetchErr) {
    const cachedCandidate = await findCachedNavigationCandidate(requestUrl);
    if (cachedCandidate) {
      return ensureOriginAgentClusterHeader(cachedCandidate);
    }

    try {
      const cachedShell = await findCachedAppShell();
      if (cachedShell) {
        return ensureOriginAgentClusterHeader(cachedShell);
      }
    } catch {}

    throw fetchErr;
  }
}

// On every SW startup (including after the browser terminates and restarts the SW
// to save memory), request the current proxy config from all window clients so the
// in-memory state is restored without requiring the user to re-save settings.
let proxyConfigReady = false;
let proxyConfigResolvers: Array<() => void> = [];

function resolveProxyConfig() {
  proxyConfigReady = true;
  for (const resolve of proxyConfigResolvers) {
    resolve();
  }

  proxyConfigResolvers = [];
}

self.clients.matchAll({ type: "window" }).then((clients) => {
  if (clients.length === 0) {
    // If no clients are open, we can't get the config. Unblock fetches.
    resolveProxyConfig();
  } else {
    clients.forEach((client) =>
      client.postMessage({ type: "request-proxy-config" }),
    );
    // Timeout to unblock fetches if clients don't respond
    setTimeout(resolveProxyConfig, 2000);
  }
});

self.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type === "set-proxy-config") {
    useProxy = !!event.data.payload?.useProxy;
    proxyUrl = event.data.payload?.proxyUrl || "/proxy";
    console.log("fetch proxy: config updated", { useProxy, proxyUrl });
    resolveProxyConfig();
  } else if (event.data?.type === "set-use-proxy") {
    // Legacy support for basic toggle
    useProxy = !!event.data.payload?.useProxy;
    resolveProxyConfig();
  }
});

self.addEventListener("fetch", (event: FetchEvent) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === location.origin) {
    if (isNavigationRequest(event.request)) {
      if (isPossibleAppRoute(requestUrl.pathname)) {
        event.respondWith(fetchAppShellWithOriginAgentCluster());

        return;
      }

      event.respondWith(fetchNavigationWithFallback(event.request, requestUrl));

      return;
    }

    const workspacePath = getWorkspaceRouteRequestPath(requestUrl.pathname);
    if (workspacePath && shouldServeWorkspaceRouteRequest(event.request)) {
      event.respondWith(
        (async () => {
          const workspaceResponse = await respondWithWorkspaceRouteFile(
            event.request,
          );
          if (workspaceResponse) {
            return workspaceResponse;
          }

          return fetch(event.request).catch((fetchErr) => {
            console.error("fetch proxy fallback error:", fetchErr);

            return new Response("Network error", { status: 502 });
          });
        })(),
      );

      return;
    }
  }

  if (shouldBypassFetchProxy(requestUrl, location.origin, proxyUrl)) {
    return;
  }

  // Only proxy http and https protocols
  if (!requestUrl.protocol.startsWith("http")) {
    return;
  }

  event.respondWith(
    (async () => {
      if (!proxyConfigReady) {
        await new Promise<void>((resolve) =>
          proxyConfigResolvers.push(resolve),
        );
      }

      // Only proxy if enabled
      if (!useProxy) {
        return fetch(event.request);
      }

      try {
        const headers: Record<string, string> = {};
        event.request.headers.forEach((value, key) => {
          headers[key] = value;
        });

        let bodyText: string | undefined;
        if (event.request.method !== "GET" && event.request.method !== "HEAD") {
          try {
            bodyText = await event.request.clone().text();
          } catch (err) {
            console.error("fetch proxy: error reading body text:", err);
          }
        }

        const targetUrl = new URL(proxyUrl, location.origin);
        targetUrl.pathname =
          (targetUrl.pathname.endsWith("/") ? "" : "/") +
          "proxy/" +
          event.request.url;

        const proxyFetchOpts: any = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: event.request.url,
            method: event.request.method,
            headers,
            body: bodyText,
          }),
        };

        const targetHostname = targetUrl.hostname.toLowerCase();
        if (
          targetHostname === "localhost" ||
          targetHostname === "127.0.0.1" ||
          targetHostname === "::1" ||
          targetHostname === "[::1]"
        ) {
          proxyFetchOpts.targetAddressSpace = "loopback";
        } else if (
          /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(targetHostname)
        ) {
          proxyFetchOpts.targetAddressSpace = "private";
        }

        const proxyResponse = await fetch(targetUrl.href, proxyFetchOpts);

        return proxyResponse;
      } catch (err) {
        console.error("fetch proxy error:", err);

        return fetch(event.request).catch((fetchErr) => {
          console.error("fetch proxy fallback error:", fetchErr);

          return new Response("Network error", { status: 502 });
        });
      }
    })(),
  );
});
