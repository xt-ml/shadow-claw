/// <reference types="@types/serviceworker" />

import { getWorkspaceRouteRequestPath } from "../app-routes.js";
import { shouldBypassFetchProxy } from "./fetch-proxy-rules.js";

/**
 * Intercept cross-origin requests and proxy them through the local /proxy endpoint
 * to circumvent CORS restrictions for the agent worker's fetch_url tool.
 */
let useProxy = false;
let proxyUrl = "/proxy";

const OPFS_ROOT = "shadowclaw";

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  apng: "image/apng",
  avif: "image/avif",
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  htm: "text/html; charset=utf-8",
  html: "text/html; charset=utf-8",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
};

function mimeTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";

  return MIME_TYPE_BY_EXTENSION[ext] || "application/octet-stream";
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

  const root = await storage.getDirectory();
  const appRoot = await root.getDirectoryHandle(OPFS_ROOT, { create: true });
  const groupsDir = await appRoot.getDirectoryHandle("groups", {
    create: true,
  });
  const safeGroupId = groupId.replace(/:/g, "-");
  const groupDir = await groupsDir.getDirectoryHandle(safeGroupId, {
    create: false,
  });
  const workspaceDir = await groupDir.getDirectoryHandle("workspace", {
    create: false,
  });

  const parts = workspacePath.split("/").filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const fileName = parts.pop();
  if (!fileName) {
    return null;
  }

  let current = workspaceDir;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: false });
  }

  const fileHandle = await current.getFileHandle(fileName, { create: false });

  return await fileHandle.getFile();
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

    const bytes = await file.arrayBuffer();

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": file.type || mimeTypeFromPath(target.path),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return null;
  }
}

// On every SW startup (including after the browser terminates and restarts the SW
// to save memory), request the current proxy config from all window clients so the
// in-memory state is restored without requiring the user to re-save settings.
self.clients.matchAll({ type: "window" }).then((clients) => {
  clients.forEach((client) =>
    client.postMessage({ type: "request-proxy-config" }),
  );
});

self.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type === "set-proxy-config") {
    useProxy = !!event.data.payload?.useProxy;
    proxyUrl = event.data.payload?.proxyUrl || "/proxy";
    console.log("fetch proxy: config updated", { useProxy, proxyUrl });
  } else if (event.data?.type === "set-use-proxy") {
    // Legacy support for basic toggle
    useProxy = !!event.data.payload?.useProxy;
  }
});

self.addEventListener("fetch", (event: FetchEvent) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === location.origin) {
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

  // Only proxy if enabled
  if (!useProxy) {
    return;
  }

  if (shouldBypassFetchProxy(requestUrl, location.origin)) {
    return;
  }

  // Only proxy http and https protocols
  if (!requestUrl.protocol.startsWith("http")) {
    return;
  }

  event.respondWith(
    (async () => {
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

        const proxyResponse = await fetch(targetUrl.href, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: event.request.url,
            method: event.request.method,
            headers,
            body: bodyText,
          }),
        });

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
