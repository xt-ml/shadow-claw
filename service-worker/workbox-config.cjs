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
    "index.mjs",
    "**service-worker**/**",
    "workbox-*.cjs",
    "workbox-*.js",
  ],
  swDest: "./service-worker.js",
  sourcemap: false,
  importScripts: ["service-worker/fetch-proxy.mjs"],
  // https://developer.chrome.com/docs/workbox/modules/workbox-build#property-BasePartial-maximumFileSizeToCacheInBytes
  // maximumFileSizeToCacheInBytes: 1024 * 1024 * 6, // 6MB
  maximumFileSizeToCacheInBytes: 1024 * 1024 * 1024, // 1GB
  // define runtime caching rules
  runtimeCaching: [
    {
      // match any request
      urlPattern: new RegExp("^.*$"),

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
