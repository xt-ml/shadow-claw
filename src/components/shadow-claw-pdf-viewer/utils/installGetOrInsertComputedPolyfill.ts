function installGetOrInsert(proto) {
  if (!proto || typeof proto.getOrInsertComputed === "function") {
    return;
  }

  Object.defineProperty(proto, "getOrInsertComputed", {
    configurable: true,
    writable: true,
    value(key, compute) {
      if (this.has(key)) {
        return this.get(key);
      }

      const value = compute();
      this.set(key, value);

      return value;
    },
  });
}

/**
 * pdf.js 5.x may call Map/WeakMap#getOrInsertComputed in some builds.
 * Safari versions without that proposal need a tiny shim.
 */
export function installGetOrInsertComputedPolyfill() {
  installGetOrInsert(Map.prototype);
  installGetOrInsert(WeakMap.prototype);
}
