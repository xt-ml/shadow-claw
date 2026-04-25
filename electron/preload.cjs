// Electron preload script — runs in a sandboxed renderer context.
// Sandboxed preloads must be CommonJS (.cjs).
//
// Expose any Electron ↔ renderer bridges here via contextBridge if needed.
// The app runs as a regular web page served from the in-process Express
// server, so we expose only the minimum necessary.
