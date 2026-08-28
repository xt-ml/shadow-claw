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
});
