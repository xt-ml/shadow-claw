import { handleAutoRefreshConfigEvent } from "./handleAutoRefreshConfigEvent.js";

describe("handleAutoRefreshConfigEvent", () => {
  it("parses interval from custom event detail", () => {
    const event = new CustomEvent("auto-refresh-config-change", {
      detail: { interval: 10 },
    });

    expect(handleAutoRefreshConfigEvent(event)).toBe(10);
  });

  it("returns null if interval is undefined or missing from detail", () => {
    const event = new CustomEvent("auto-refresh-config-change", {
      detail: {},
    });

    expect(handleAutoRefreshConfigEvent(event)).toBeNull();
  });
});
