import { shouldRunAutoRefresh } from "./shouldRunAutoRefresh.js";

describe("shouldRunAutoRefresh", () => {
  it("returns true when interval > 0, page is not hidden, and component is connected", () => {
    expect(shouldRunAutoRefresh(10, false, true)).toBe(true);
  });

  it("returns false when interval <= 0", () => {
    expect(shouldRunAutoRefresh(0, false, true)).toBe(false);
    expect(shouldRunAutoRefresh(-5, false, true)).toBe(false);
  });

  it("returns false when document is hidden or element is disconnected", () => {
    expect(shouldRunAutoRefresh(10, true, true)).toBe(false);
    expect(shouldRunAutoRefresh(10, false, false)).toBe(false);
  });
});
