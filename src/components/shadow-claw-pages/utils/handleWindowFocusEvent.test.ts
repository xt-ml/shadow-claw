import { handleWindowFocusEvent } from "./handleWindowFocusEvent.js";

describe("handleWindowFocusEvent", () => {
  it("returns true when document is not hidden and component is connected", () => {
    expect(handleWindowFocusEvent(false, true)).toBe(true);
  });

  it("returns false when document is hidden or disconnected", () => {
    expect(handleWindowFocusEvent(true, true)).toBe(false);
    expect(handleWindowFocusEvent(false, false)).toBe(false);
  });
});
