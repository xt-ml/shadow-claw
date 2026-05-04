module.exports = {
  globDirectory: "dist/public/",
  globPatterns: [
    "**/**.css",
    "**/**.html",
    "**/**.ico",
    "**/**.json",
    "**/**.js",
    "**/**.png",
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
  ],
  swDest: "dist/public/service-worker.js",
  sourcemap: false,
  importScripts: [
    "service-worker/fetch-proxy.js",
    "service-worker/push-handler.js",
    "service-worker/share-target.js",
  ],
  // // Force new service worker versions to activate and control pages immediately.
  // skipWaiting: true,
  clientsClaim: true,
  // cleanupOutdatedCaches: true,
  // https://developer.chrome.com/docs/workbox/modules/workbox-build#property-BasePartial-maximumFileSizeToCacheInBytes
  // maximumFileSizeToCacheInBytes: 1024 * 1024 * 6, // 6MB
  maximumFileSizeToCacheInBytes: 1024 * 1024 * 1024, // 1GB
  // define runtime caching rules
  runtimeCaching: [
    {
      // exclude loopback proxy paths and channel endpoints that should never be cached
      urlPattern: ({ url }) => {
        // Skip VM asset paths to avoid flooding CacheStorage with high-volume chunk requests.
        if (
          url.pathname.startsWith("/assets/v86.9pfs/")
          //   || url.pathname.startsWith("/assets/v86.ext2/")
        ) {
          return false;
        }

        const isLoopback =
          url.hostname === "localhost" || url.hostname === "127.0.0.1";

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

        return !(isLoopback && isProxyPath);
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
