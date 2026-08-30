import { jest } from "@jest/globals";
import { installGetOrInsertComputedPolyfill } from "./installGetOrInsertComputedPolyfill.js";

describe("installGetOrInsertComputedPolyfill", () => {
  let originalMapMethod: any;
  let originalWeakMapMethod: any;

  beforeEach(() => {
    originalMapMethod = (Map.prototype as any).getOrInsertComputed;
    originalWeakMapMethod = (WeakMap.prototype as any).getOrInsertComputed;
    delete (Map.prototype as any).getOrInsertComputed;
    delete (WeakMap.prototype as any).getOrInsertComputed;
  });

  afterEach(() => {
    if (originalMapMethod) {
      (Map.prototype as any).getOrInsertComputed = originalMapMethod;
    } else {
      delete (Map.prototype as any).getOrInsertComputed;
    }

    if (originalWeakMapMethod) {
      (WeakMap.prototype as any).getOrInsertComputed = originalWeakMapMethod;
    } else {
      delete (WeakMap.prototype as any).getOrInsertComputed;
    }
  });

  it("installs polyfill on Map and WeakMap prototypes and computes missing values", () => {
    installGetOrInsertComputedPolyfill();

    const map = new Map<string, number>();
    const compute = jest.fn(() => 42);

    const val1 = (map as any).getOrInsertComputed("foo", compute);
    expect(val1).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);

    // Second call should return cached value without computing
    const val2 = (map as any).getOrInsertComputed("foo", compute);
    expect(val2).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);

    const weakMap = new WeakMap<object, string>();
    const keyObj = {};
    const weakCompute = jest.fn(() => "computed");

    const wVal1 = (weakMap as any).getOrInsertComputed(keyObj, weakCompute);
    expect(wVal1).toBe("computed");
    expect(weakCompute).toHaveBeenCalledTimes(1);

    const wVal2 = (weakMap as any).getOrInsertComputed(keyObj, weakCompute);
    expect(wVal2).toBe("computed");
    expect(weakCompute).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite existing getOrInsertComputed", () => {
    const existing = jest.fn();
    (Map.prototype as any).getOrInsertComputed = existing;

    installGetOrInsertComputedPolyfill();

    expect((Map.prototype as any).getOrInsertComputed).toBe(existing);
  });
});
