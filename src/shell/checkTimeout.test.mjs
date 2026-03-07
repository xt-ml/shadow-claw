import { checkTimeout } from "./checkTimeout.mjs";

describe("checkTimeout", () => {
  it("should not throw if within timeout", () => {
    const ctx = /** @type {any} */ ({
      startedAt: Date.now(),
      timeoutMs: 1000,
    });

    expect(() => checkTimeout(ctx)).not.toThrow();
  });

  it("should throw if timeout exceeded", () => {
    const ctx = /** @type {any} */ ({
      startedAt: Date.now() - 2000,
      timeoutMs: 1000,
    });

    expect(() => checkTimeout(ctx)).toThrow("[command timed out]");
  });
});
