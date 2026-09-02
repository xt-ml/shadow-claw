module.exports = {
  globDirectory: "dist/public/",
  globPatterns: [
    "**/*.css",
    "**/*.html",
    "**/*.ico",
    "**/*.json",
    "**/*.js",
    "**/*.png",
  ],
  globIgnores: [
    "**/bin/**",
    "**/coverage/**",
    "**/node_modules/**",
    "assets/v86**/**",
    "index.ts",
    "**service-worker**/**",
    "workbox-*.cjs",
    "workbox-*.js",
    // Exclude non-runtime files from precache
    "**/*.test.js",
    "e2e/**",
    "electron/**",
    "**/__mocks__/**",
    "**/*TestHarness.js",
    "**/*testHarness.js",
    "jest.config.js",
    "playwright.config.js",
    "tsconfig.json",
    "package-lock.json",
    "**/routes.json",
  ],
  swDest: "dist/public/service-worker.js",
  sourcemap: false,
  importScripts: [
    "service-worker/fetch-proxy.js",
    "service-worker/push-handler.js",
    "service-worker/share-target.js",
  ],
  // // Force new service worker to activate and control pages immediately (bypassing dialog asking for reload).
  // skipWaiting: true,
  clientsClaim: true,
  navigateFallback: "index.html",
  navigateFallbackAllowlist: [
    /^\/$/,
    /^\/(chat|files|pages|tasks|settings)(?:\/.*)?$/,
  ],
  // cleanupOutdatedCaches: true,
  // https://developer.chrome.com/docs/workbox/modules/workbox-build#property-BasePartial-maximumFileSizeToCacheInBytes
  // maximumFileSizeToCacheInBytes: 1024 * 1024 * 6, // 6MB
  maximumFileSizeToCacheInBytes: 1024 * 1024 * 1024 * 10, // 10GB
  // define runtime caching rules
  runtimeCaching: [
    {
      // exclude loopback proxy paths, Hugging Face / model downloads, CDN hosts, and channel endpoints
      urlPattern: ({ url, sameOrigin }) => {
        // Skip VM asset paths to avoid flooding CacheStorage with high-volume chunk requests.
        if (
          url.pathname.startsWith("/assets/v86.9pfs/")
          //   || url.pathname.startsWith("/assets/v86.ext2/")
        ) {
          return false;
        }

        const hostname = url.hostname.toLowerCase();

        const isBypassDomain =
          hostname === "huggingface.co" ||
          hostname.endsWith(".huggingface.co") ||
          hostname.endsWith(".hf.co") ||
          hostname === "hf.co" ||
          hostname === "hf-mirror.com" ||
          hostname.endsWith(".hf-mirror.com") ||
          hostname === "cdnjs.cloudflare.com" ||
          hostname === "esm.sh" ||
          hostname.endsWith(".esm.sh") ||
          hostname === "unpkg.com" ||
          hostname === "cdn.jsdelivr.net" ||
          hostname.endsWith(".jsdelivr.net") ||
          hostname === "esm.run" ||
          hostname === "openrouter.ai" ||
          hostname.endsWith(".openrouter.ai") ||
          hostname === "api.telegram.org";

        if (isBypassDomain) {
          return false;
        }

        // Never cache streaming control plane, proxy, or server-side API endpoints
        const isControlPlanePath = url.pathname.startsWith("/api/control/");
        if (isControlPlanePath) {
          return false;
        }

        const isShareTargetPath = url.pathname.endsWith(
          "/share/share-target.html",
        );

        const isProxyPath =
          url.pathname === "/proxy" ||
          url.pathname.startsWith("/git-proxy/") ||
          isShareTargetPath ||
          url.pathname.startsWith("/push/") ||
          url.pathname.startsWith("/schedule/") ||
          url.pathname.startsWith("/telegram/");

        const isLoopback =
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1" ||
          hostname === "[::1]";

        if (isLoopback && isProxyPath) {
          return false;
        }

        // When sameOrigin is provided by Workbox, only cache same-origin assets.
        // Cross-origin requests (e.g. static site calling local control plane/LAN endpoints)
        // should never be intercepted by Workbox runtime cache.
        if (typeof sameOrigin === "boolean") {
          return sameOrigin;
        }

        return true;
      },

      // apply a network-first strategy
      handler: "NetworkFirst",

      options: {
        // use a custom cache name
        cacheName: "shadow-claw-cache",

        expiration: {
          // 365 days
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
  ],
};
