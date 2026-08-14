import { isCacheStorageAvailable } from "./isCacheStorageAvailable.js";

describe("isCacheStorageAvailable", () => {
  let originalCaches: any;

  beforeEach(() => {
    originalCaches = (globalThis as any).caches;
  });

  afterEach(() => {
    if (originalCaches !== undefined) {
      (globalThis as any).caches = originalCaches;
    } else {
      delete (globalThis as any).caches;
    }
  });

  it("returns true when caches and caches.open are available", () => {
    (globalThis as any).caches = {
      open: () => Promise.resolve({}),
    };
    expect(isCacheStorageAvailable()).toBe(true);
  });

  it("returns false when caches is undefined", () => {
    delete (globalThis as any).caches;
    expect(isCacheStorageAvailable()).toBe(false);
  });

  it("returns false when caches.open is not a function", () => {
    (globalThis as any).caches = {};
    expect(isCacheStorageAvailable()).toBe(false);
  });
});
