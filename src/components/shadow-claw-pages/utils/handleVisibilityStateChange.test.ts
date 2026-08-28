import { handleVisibilityStateChange } from "./handleVisibilityStateChange.js";

describe("handleVisibilityStateChange", () => {
  it("returns 'render-and-timer' when document is visible and component is connected", () => {
    expect(handleVisibilityStateChange(false, true, false)).toBe(
      "render-and-timer",
    );
  });

  it("returns 'clear-timer' when document becomes hidden and auto-refresh timer is running", () => {
    expect(handleVisibilityStateChange(true, true, true)).toBe("clear-timer");
  });

  it("returns 'noop' when document is hidden and no timer running or disconnected", () => {
    expect(handleVisibilityStateChange(true, false, false)).toBe("noop");
    expect(handleVisibilityStateChange(false, false, false)).toBe("noop");
  });
});
