import { backoffDelayMs } from "./backoffDelayMs.js";

describe("backoffDelayMs", () => {
  it("calculates exponential backoff based on attempt number", () => {
    expect(backoffDelayMs(1)).toBe(1000);
    expect(backoffDelayMs(2)).toBe(2000);
    expect(backoffDelayMs(3)).toBe(4000);
    expect(backoffDelayMs(4)).toBe(8000);
    expect(backoffDelayMs(5)).toBe(15000); // capped at 15000
    expect(backoffDelayMs(6)).toBe(15000); // capped at 15000
  });

  it("handles non-positive attempts safely", () => {
    expect(backoffDelayMs(0)).toBeLessThanOrEqual(1000);
    expect(backoffDelayMs(-1)).toBeLessThanOrEqual(1000);
  });
});
