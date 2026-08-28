import { handleMouseDownGesture } from "./handleMouseDownGesture.js";

describe("handleMouseDownGesture", () => {
  it("resets mouse state if button is not 0 or event is suppressed", () => {
    const event1 = {
      button: 1,
      clientX: 100,
      clientY: 200,
    } as unknown as MouseEvent;
    expect(handleMouseDownGesture(event1, false)).toEqual({
      mouseStartX: 0,
      mouseStartY: 0,
      mouseStartTime: 0,
      isMouseDown: false,
    });

    const event2 = {
      button: 0,
      clientX: 100,
      clientY: 200,
    } as unknown as MouseEvent;
    expect(handleMouseDownGesture(event2, true)).toEqual({
      mouseStartX: 0,
      mouseStartY: 0,
      mouseStartTime: 0,
      isMouseDown: false,
    });
  });

  it("captures start coordinates when primary mouse button is pressed", () => {
    const now = 5000;
    const event = {
      button: 0,
      clientX: 150,
      clientY: 250,
    } as unknown as MouseEvent;
    expect(handleMouseDownGesture(event, false, now)).toEqual({
      mouseStartX: 150,
      mouseStartY: 250,
      mouseStartTime: 5000,
      isMouseDown: true,
    });
  });
});
