import { detectSwipeDirection } from "./detectSwipeDirection.js";

describe("detectSwipeDirection", () => {
  const startTime = 1000;

  it("returns 'next' for leftward horizontal swipe exceeding minDistance within time limit", () => {
    // startX = 200, endX = 100 => deltaX = -100
    expect(
      detectSwipeDirection(200, 100, 100, 100, startTime, startTime + 300),
    ).toBe("next");
  });

  it("returns 'previous' for rightward horizontal swipe exceeding minDistance within time limit", () => {
    // startX = 100, endX = 200 => deltaX = 100
    expect(
      detectSwipeDirection(100, 100, 200, 100, startTime, startTime + 300),
    ).toBe("previous");
  });

  it("returns null when horizontal distance is less than minDistance (50px)", () => {
    expect(
      detectSwipeDirection(100, 100, 140, 100, startTime, startTime + 300),
    ).toBeNull();
  });

  it("returns null when vertical movement exceeds horizontal movement", () => {
    // deltaX = 60, deltaY = 80
    expect(
      detectSwipeDirection(100, 100, 160, 180, startTime, startTime + 300),
    ).toBeNull();
  });

  it("returns null when swipe duration exceeds maxTime (600ms)", () => {
    expect(
      detectSwipeDirection(200, 100, 100, 100, startTime, startTime + 700),
    ).toBeNull();
  });
});
