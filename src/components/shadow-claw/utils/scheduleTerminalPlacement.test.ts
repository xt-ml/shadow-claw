import { jest } from "@jest/globals";

describe("scheduleTerminalPlacement", () => {
  let scheduleTerminalPlacement: any;
  let mockSyncTerminalPlacement: any;
  let shadowRoot: any;
  let terminalElement: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    shadowRoot = {};
    terminalElement = {};

    mockSyncTerminalPlacement = jest.fn();

    jest.unstable_mockModule("./syncTerminalPlacement.js", () => ({
      syncTerminalPlacement: mockSyncTerminalPlacement,
    }));

    // Mock requestAnimationFrame and cancelAnimationFrame
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(cb, 0) as any;
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id as any);

    const module = await import("./scheduleTerminalPlacement.js");
    scheduleTerminalPlacement = module.scheduleTerminalPlacement;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it("should cancel existing frame and schedule a new one", () => {
    const cancelSpy = jest.spyOn(globalThis, "cancelAnimationFrame");
    const requestSpy = jest.spyOn(globalThis, "requestAnimationFrame");

    scheduleTerminalPlacement(shadowRoot, "chat", terminalElement, true, 123);

    expect(cancelSpy).toHaveBeenCalledWith(123);
    expect(requestSpy).toHaveBeenCalled();

    jest.runAllTimers();

    expect(mockSyncTerminalPlacement).toHaveBeenCalledWith(
      shadowRoot,
      "chat",
      terminalElement,
      true,
    );
  });

  it("should not cancel if existing frame is null", () => {
    const cancelSpy = jest.spyOn(globalThis, "cancelAnimationFrame");
    const requestSpy = jest.spyOn(globalThis, "requestAnimationFrame");

    scheduleTerminalPlacement(shadowRoot, "chat", terminalElement, true, null);

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(requestSpy).toHaveBeenCalled();

    jest.runAllTimers();

    expect(mockSyncTerminalPlacement).toHaveBeenCalledWith(
      shadowRoot,
      "chat",
      terminalElement,
      true,
    );
  });
});
