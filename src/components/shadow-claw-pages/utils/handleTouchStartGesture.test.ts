import { handleTouchStartGesture } from "./handleTouchStartGesture.js";

describe("handleTouchStartGesture", () => {
  it("resets touch coordinates when touch is suppressed", () => {
    const event = {
      touches: [{ clientX: 100, clientY: 200 }],
    } as unknown as TouchEvent;
    const result = handleTouchStartGesture(event, true);
    expect(result).toEqual({
      touchStartX: 0,
      touchStartY: 0,
      touchStartTime: 0,
    });
  });

  it("captures touch coordinates and timestamp when single touch starts", () => {
    const now = Date.now();
    const event = {
      touches: [{ clientX: 150, clientY: 250 }],
    } as unknown as TouchEvent;
    const result = handleTouchStartGesture(event, false, now);
    expect(result).toEqual({
      touchStartX: 150,
      touchStartY: 250,
      touchStartTime: now,
    });
  });

  it("returns null when touches array is missing or contains multi-touch", () => {
    const event = {
      touches: [{ clientX: 10 }, { clientY: 20 }],
    } as unknown as TouchEvent;
    const result = handleTouchStartGesture(event, false);
    expect(result).toBeNull();
  });
});
