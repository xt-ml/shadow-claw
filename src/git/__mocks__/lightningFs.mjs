// Stub for @isomorphic-git/lightning-fs (ESM default export)
// In tests, globalThis.LightningFS is set by beforeEach in git.test.mjs
export default globalThis.LightningFS ||
  function LightningFS() {
    return { promises: {} };
  };
