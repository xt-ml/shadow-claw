/// <reference types="@types/serviceworker" />

import { shouldBypassFetchProxy } from "./fetch-proxy-rules.js";

/**
 * Intercept cross-origin requests and proxy them through the local /proxy endpoint
 * to circumvent CORS restrictions for the agent worker's fetch_url tool.
 */
let useProxy = false;
let proxyUrl = "/proxy";

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

        return fetch(event.request);
      }
    })(),
  );
});
