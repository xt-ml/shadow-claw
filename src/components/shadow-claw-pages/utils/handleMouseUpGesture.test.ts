import { handleMouseUpGesture } from "./handleMouseUpGesture.js";

describe("handleMouseUpGesture", () => {
  const startTime = 1000;
  const mouseState = {
    mouseStartX: 200,
    mouseStartY: 100,
    mouseStartTime: startTime,
    isMouseDown: true,
  };

  it("returns null if mouse was not down, gesture suppressed, or text selection present", () => {
    const event = { clientX: 50, clientY: 100 } as unknown as MouseEvent;
    expect(
      handleMouseUpGesture(
        event,
        { ...mouseState, isMouseDown: false },
        false,
        false,
      ),
    ).toBeNull();
    expect(handleMouseUpGesture(event, mouseState, true, false)).toBeNull();
    expect(handleMouseUpGesture(event, mouseState, false, true)).toBeNull();
  });

  it("detects mouse drag swipe direction 'next'", () => {
    const event = { clientX: 50, clientY: 100 } as unknown as MouseEvent;
    expect(
      handleMouseUpGesture(event, mouseState, false, false, startTime + 200),
    ).toBe("next");
  });
});
