module.exports = {
  globDirectory: "./",
  globPatterns: [
    "**/**.css",
    "**/**.gif",
    "**/**.html",
    "**/**.ico",
    "**/**.js",
    "**/**.json",
    "**/**.mjs",
    "**/**.png",
    "**/**.wasm",
    "**/**.bin",
  ],
  globIgnores: [
    "**/bin/**",
    "**/coverage/**",
    "**/node_modules/**",
    "assets/v86**/**",
    "index.mjs",
    "**service-worker**/**",
    "workbox-*.cjs",
    "workbox-*.js",
  ],
  swDest: "./service-worker.js",
  sourcemap: false,
  // importScripts: ["service-worker/fetch-proxy.mjs"],
  // // Force new service worker versions to activate and control pages immediately.
  // skipWaiting: true,
  // clientsClaim: true,
  // cleanupOutdatedCaches: true,
  // https://developer.chrome.com/docs/workbox/modules/workbox-build#property-BasePartial-maximumFileSizeToCacheInBytes
  // maximumFileSizeToCacheInBytes: 1024 * 1024 * 6, // 6MB
  maximumFileSizeToCacheInBytes: 1024 * 1024 * 1024, // 1GB
  // define runtime caching rules
  runtimeCaching: [
    {
      // exclude only loopback proxy paths
      urlPattern: ({ url }) => {
        // // Skip VM asset paths to avoid flooding CacheStorage with high-volume chunk requests.
        // if (
        //   url.pathname.startsWith("/assets/v86.9pfs/") ||
        //   url.pathname.startsWith("/assets/v86.ext2/")
        // ) {
        //   return false;
        // }

        const isLoopback =
          url.hostname === "localhost" || url.hostname === "127.0.0.1";

        const isProxyPath =
          url.pathname === "/proxy" || url.pathname.startsWith("/git-proxy/");

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
