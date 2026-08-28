import { shouldHandleKeyDownNavigation } from "./shouldHandleKeyDownNavigation.js";

describe("shouldHandleKeyDownNavigation", () => {
  it("returns 'previous' for un-modified ArrowLeft key when navigation is not suppressed", () => {
    const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    expect(shouldHandleKeyDownNavigation(event, false)).toBe("previous");
  });

  it("returns 'next' for un-modified ArrowRight key when navigation is not suppressed", () => {
    const event = new KeyboardEvent("keydown", { key: "ArrowRight" });
    expect(shouldHandleKeyDownNavigation(event, false)).toBe("next");
  });

  it("returns null for non-arrow keys", () => {
    const event = new KeyboardEvent("keydown", { key: "Enter" });
    expect(shouldHandleKeyDownNavigation(event, false)).toBeNull();
  });

  it("returns null when modifier keys (ctrl, alt, meta) are held", () => {
    const ctrlEvent = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      ctrlKey: true,
    });
    const metaEvent = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      metaKey: true,
    });
    expect(shouldHandleKeyDownNavigation(ctrlEvent, false)).toBeNull();
    expect(shouldHandleKeyDownNavigation(metaEvent, false)).toBeNull();
  });

  it("returns null when navigation is suppressed", () => {
    const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    expect(shouldHandleKeyDownNavigation(event, true)).toBeNull();
  });
});
