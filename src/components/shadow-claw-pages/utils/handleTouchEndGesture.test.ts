import { handleTouchEndGesture } from "./handleTouchEndGesture.js";

describe("handleTouchEndGesture", () => {
  const startTime = 1000;
  const touchState = {
    touchStartX: 200,
    touchStartY: 100,
    touchStartTime: startTime,
  };

  it("returns null if touchStartTime is 0 or gesture is suppressed", () => {
    const event = {
      changedTouches: [{ clientX: 50, clientY: 100 }],
    } as unknown as TouchEvent;
    expect(
      handleTouchEndGesture(event, { ...touchState, touchStartTime: 0 }, false),
    ).toBeNull();
    expect(handleTouchEndGesture(event, touchState, true)).toBeNull();
  });

  it("returns direction 'next' for leftward swipe", () => {
    const event = {
      changedTouches: [{ clientX: 50, clientY: 100 }],
    } as unknown as TouchEvent;
    expect(
      handleTouchEndGesture(event, touchState, false, startTime + 200),
    ).toBe("next");
  });

  it("returns direction 'previous' for rightward swipe", () => {
    const state = {
      touchStartX: 50,
      touchStartY: 100,
      touchStartTime: startTime,
    };
    const event = {
      changedTouches: [{ clientX: 200, clientY: 100 }],
    } as unknown as TouchEvent;
    expect(handleTouchEndGesture(event, state, false, startTime + 200)).toBe(
      "previous",
    );
  });
});
