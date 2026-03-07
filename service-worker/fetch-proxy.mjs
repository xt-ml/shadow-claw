/**
 * Intercept cross-origin requests and proxy them through the local /proxy endpoint
 * to circumvent CORS restrictions for the agent worker's fetch_url tool.
 */

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip requests to the same origin
  if (requestUrl.origin === location.origin) {
    return;
  }

  // Skip requests to CDNs (used for module imports)
  const bypassHosts = ["esm.sh", "unpkg.com", "cdn.jsdelivr.net", "esm.run"];
  if (bypassHosts.includes(requestUrl.hostname)) {
    return;
  }

  // Only proxy http and https protocols
  if (!requestUrl.protocol.startsWith("http")) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const headers = {};
        for (const [key, value] of event.request.headers.entries()) {
          headers[key] = value;
        }

        let bodyText = undefined;
        if (event.request.method !== "GET" && event.request.method !== "HEAD") {
          // Clone the request to read its body, as it might be consumed
          const reqClone = event.request.clone();
          try {
            bodyText = await reqClone.text();
          } catch (err) {
            console.error("fetch proxy: error reading body text:", err);
          }
        }

        const proxyPayload = {
          url: event.request.url,
          method: event.request.method,
          headers: headers,
          body: bodyText,
        };

        const targetUrl = new URL("/proxy", location.origin);

        const proxyResponse = await fetch(targetUrl.href, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(proxyPayload),
        });

        // If the proxy responds successfully, return its response
        if (proxyResponse.ok) {
          return proxyResponse;
        }

        // If the proxy itself fails, fallback to normal fetch
        return fetch(event.request);
      } catch (err) {
        console.error("fetch proxy error:", err);
        // Fallback to normal fetch if the proxy process completely errors out
        return fetch(event.request);
      }
    })(),
  );
});
