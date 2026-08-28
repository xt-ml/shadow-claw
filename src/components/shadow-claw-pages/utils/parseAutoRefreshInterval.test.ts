import { parseAutoRefreshInterval } from "./parseAutoRefreshInterval.js";

describe("parseAutoRefreshInterval", () => {
  it("parses valid positive integer numbers and strings", () => {
    expect(parseAutoRefreshInterval(30)).toBe(30);
    expect(parseAutoRefreshInterval("60")).toBe(60);
    expect(parseAutoRefreshInterval(0)).toBe(0);
  });

  it("clamps values to maximum 86400 seconds (24 hours)", () => {
    expect(parseAutoRefreshInterval(100000)).toBe(86400);
    expect(parseAutoRefreshInterval("999999")).toBe(86400);
  });

  it("returns 0 for negative, NaN, null, or invalid inputs", () => {
    expect(parseAutoRefreshInterval(-10)).toBe(0);
    expect(parseAutoRefreshInterval("invalid")).toBe(0);
    expect(parseAutoRefreshInterval(null)).toBe(0);
    expect(parseAutoRefreshInterval(undefined)).toBe(0);
    expect(parseAutoRefreshInterval({})).toBe(0);
  });
});
