import { jest } from "@jest/globals";
import { handleKeyDownNavigation } from "./handleKeyDownNavigation.js";

describe("handleKeyDownNavigation", () => {
  it("does nothing if element is not connected", () => {
    const onNavigate = jest.fn();
    const event = {
      preventDefault: jest.fn(),
      key: "ArrowLeft",
    } as unknown as KeyboardEvent;

    handleKeyDownNavigation(event, false, null, onNavigate);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("navigates left (previous) on ArrowLeft when not suppressed", () => {
    const onNavigate = jest.fn();
    const event = {
      preventDefault: jest.fn(),
      key: "ArrowLeft",
      target: document.body,
    } as unknown as KeyboardEvent;

    handleKeyDownNavigation(event, true, null, onNavigate);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith("previous");
  });

  it("navigates right (next) on ArrowRight when not suppressed", () => {
    const onNavigate = jest.fn();
    const event = {
      preventDefault: jest.fn(),
      key: "ArrowRight",
      target: document.body,
    } as unknown as KeyboardEvent;

    handleKeyDownNavigation(event, true, null, onNavigate);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith("next");
  });

  it("does nothing when target input is focused (suppressed navigation)", () => {
    const onNavigate = jest.fn();
    const input = document.createElement("input");
    const event = {
      preventDefault: jest.fn(),
      key: "ArrowRight",
      target: input,
    } as unknown as KeyboardEvent;

    handleKeyDownNavigation(event, true, null, onNavigate);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("throttles rapid keydown events in the same direction", () => {
    const onNavigate = jest.fn();
    const state = { lastNavigationTime: 0, lastDirection: null };
    const event1 = {
      preventDefault: jest.fn(),
      key: "ArrowRight",
      target: document.body,
    } as unknown as KeyboardEvent;
    const event2 = {
      preventDefault: jest.fn(),
      key: "ArrowRight",
      target: document.body,
    } as unknown as KeyboardEvent;

    // First keydown at t = 1000ms
    handleKeyDownNavigation(event1, true, null, onNavigate, state, 300, 1000);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("next");
    expect(event1.preventDefault).toHaveBeenCalled();
    expect(state.lastNavigationTime).toBe(1000);
    expect(state.lastDirection).toBe("next");

    // Second keydown 50ms later (t = 1050ms) - should be throttled
    handleKeyDownNavigation(event2, true, null, onNavigate, state, 300, 1050);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(event2.preventDefault).toHaveBeenCalled();
    expect(state.lastNavigationTime).toBe(1000);
  });

  it("allows navigation after throttle duration has elapsed", () => {
    const onNavigate = jest.fn();
    const state = { lastNavigationTime: 1000, lastDirection: "next" as const };
    const event = {
      preventDefault: jest.fn(),
      key: "ArrowRight",
      target: document.body,
    } as unknown as KeyboardEvent;

    // Keydown at t = 1300ms (300ms elapsed)
    handleKeyDownNavigation(event, true, null, onNavigate, state, 300, 1300);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("next");
    expect(state.lastNavigationTime).toBe(1300);
  });

  it("allows immediate navigation when switching direction within throttle window", () => {
    const onNavigate = jest.fn();
    const state = { lastNavigationTime: 1000, lastDirection: "next" as const };
    const event = {
      preventDefault: jest.fn(),
      key: "ArrowLeft",
      target: document.body,
    } as unknown as KeyboardEvent;

    // Keydown in opposite direction at t = 1050ms
    handleKeyDownNavigation(event, true, null, onNavigate, state, 300, 1050);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("previous");
    expect(state.lastNavigationTime).toBe(1050);
    expect(state.lastDirection).toBe("previous");
  });
});
