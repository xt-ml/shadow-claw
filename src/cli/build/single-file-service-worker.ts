/**
 * Standalone service worker for single-file builds. Only index.html is deployed,
 * so it caches that document and the runtime assets fetched from the CDN.
 */
export function generateSingleFileServiceWorker(
  cdnBase: string,
  buildVersion: string,
): string {
  const base = JSON.stringify(cdnBase.replace(/\/+$/, "") + "/");

  return `// build: ${buildVersion}
const CDN_BASE = ${base};
const CACHE_NAME = "shadow-claw-single-file";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (request.url.startsWith(CDN_BASE)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
`;
}

export interface SingleFileSwRegistrationOptions {
  checkIntervalMs: number;
  checkOnFocus: boolean;
  checkMinGapMs: number;
  repromptIntervalMs: number;
}

/** Inline registration script that mirrors the main app's update dialog flow. */
export function generateSingleFileSwRegistration(
  options: SingleFileSwRegistrationOptions,
): string {
  return `  <script data-shadow-claw-sw="true">
    (() => {
      if (!("serviceWorker" in navigator)) return;
      const CHECK_INTERVAL_MS = ${Number(options.checkIntervalMs)};
      const CHECK_ON_FOCUS = ${Boolean(options.checkOnFocus)};
      const CHECK_MIN_GAP_MS = ${Number(options.checkMinGapMs)};
      const REPROMPT_INTERVAL_MS = ${Number(options.repromptIntervalMs)};
      const hadController = Boolean(navigator.serviceWorker.controller);
      let registration = null;
      let updateRequested = false;
      let prompting = false;
      let nextPromptAt = 0;
      let lastCheckAt = 0;

      async function requestDialog(options) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < 5000) {
          const el = document.querySelector("shadow-claw");
          if (el && typeof el.requestDialog === "function") {
            return el.requestDialog(options);
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return null;
      }

      async function promptUpdate() {
        const waiting = registration && registration.waiting;
        if (!waiting || prompting || Date.now() < nextPromptAt) return;
        prompting = true;
        try {
          const accepted = await requestDialog({
            title: "Update Available",
            message: "A new version of ShadowClaw is ready. Reload now to apply the update?",
            confirmLabel: "Reload now",
            cancelLabel: "Later",
          });
          if (accepted === null) return;
          if (accepted) {
            updateRequested = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          } else {
            nextPromptAt = Date.now() + REPROMPT_INTERVAL_MS;
          }
        } finally {
          prompting = false;
        }
      }

      async function checkForUpdate(fromFocus) {
        if (!registration) return;
        if (fromFocus && Date.now() - lastCheckAt < CHECK_MIN_GAP_MS) return;
        lastCheckAt = Date.now();
        try {
          await registration.update();
        } catch {}
        await promptUpdate();
      }

      navigator.serviceWorker.addEventListener("controllerchange", async () => {
        if (updateRequested) {
          location.reload();
          return;
        }
        if (!hadController) return;
        const accepted = await requestDialog({
          title: "Update Installed",
          message: "A new version of ShadowClaw was installed. Reload now?",
          confirmLabel: "Reload now",
          cancelLabel: "Later",
        });
        if (accepted) location.reload();
      });

      window.addEventListener("load", async () => {
        try {
          let swUrl = "service-worker.js";
          try {
            if (window.trustedTypes && typeof window.trustedTypes.getPolicy === "function") {
              const defaultPolicy =
                window.trustedTypes.getPolicy("default") ||
                window.trustedTypes.getPolicy("shadowclaw-sandbox");
              if (defaultPolicy && typeof defaultPolicy.createScriptURL === "function") {
                swUrl = defaultPolicy.createScriptURL(swUrl);
              }
            }
          } catch {}
          registration = await navigator.serviceWorker.register(swUrl, {
            updateViaCache: "none",
          });
        } catch {
          return;
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate();
            }
          });
        });
        promptUpdate();
        if (CHECK_INTERVAL_MS > 0) {
          setInterval(() => checkForUpdate(false), CHECK_INTERVAL_MS);
        }
        if (CHECK_ON_FOCUS) {
          window.addEventListener("focus", () => checkForUpdate(true));
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") checkForUpdate(true);
          });
        }
      });
    })();
  </script>`;
}
