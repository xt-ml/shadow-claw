import { jest } from "@jest/globals";
import { setupAppLifecycle } from "./setupAppLifecycle.js";

describe("setupAppLifecycle", () => {
  let win: any;
  let doc: any;
  let orchestrator: any;
  let winListeners: Record<string, Function>;
  let docListeners: Record<string, Function>;

  beforeEach(() => {
    jest.useFakeTimers();
    winListeners = {};
    docListeners = {};

    win = {
      addEventListener: jest.fn((event: string, handler: Function) => {
        winListeners[event] = handler;
      }),
      removeEventListener: jest.fn((event: string) => {
        delete winListeners[event];
      }),
    };

    doc = {
      visibilityState: "visible",
      addEventListener: jest.fn((event: string, handler: Function) => {
        docListeners[event] = handler;
      }),
      removeEventListener: jest.fn((event: string) => {
        delete docListeners[event];
      }),
    };

    orchestrator = {
      ensureAllConnections: jest.fn().mockResolvedValue(undefined as never),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("registers event listeners on win and doc", () => {
    const cleanup = setupAppLifecycle(win, doc, orchestrator);

    expect(doc.addEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(win.addEventListener).toHaveBeenCalledWith(
      "pageshow",
      expect.any(Function),
    );
    expect(win.addEventListener).toHaveBeenCalledWith(
      "focus",
      expect.any(Function),
    );
    expect(win.addEventListener).toHaveBeenCalledWith(
      "online",
      expect.any(Function),
    );

    cleanup();

    expect(doc.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(win.removeEventListener).toHaveBeenCalledWith(
      "pageshow",
      expect.any(Function),
    );
    expect(win.removeEventListener).toHaveBeenCalledWith(
      "focus",
      expect.any(Function),
    );
    expect(win.removeEventListener).toHaveBeenCalledWith(
      "online",
      expect.any(Function),
    );
  });

  it("triggers ensureAllConnections({ force: true }) on wake up from sleep (> 1000ms hidden)", () => {
    setupAppLifecycle(win, doc, orchestrator, {
      debounceMs: 100,
      minSleepDurationMs: 1000,
    });

    // App goes to sleep / hidden
    doc.visibilityState = "hidden";
    docListeners["visibilitychange"]();

    // Advance time by 5 seconds while phone sleeps
    jest.advanceTimersByTime(5000);

    // App wakes up
    doc.visibilityState = "visible";
    docListeners["visibilitychange"]();

    // Before debounce timer fires
    expect(orchestrator.ensureAllConnections).not.toHaveBeenCalled();

    // Advance past debounce
    jest.advanceTimersByTime(100);

    expect(orchestrator.ensureAllConnections).toHaveBeenCalledWith({
      force: true,
    });
  });

  it("triggers ensureAllConnections({ force: false }) on short tab switch (< 1000ms hidden)", () => {
    setupAppLifecycle(win, doc, orchestrator, {
      debounceMs: 100,
      minSleepDurationMs: 1000,
    });

    doc.visibilityState = "hidden";
    docListeners["visibilitychange"]();

    // Only hidden for 200ms
    jest.advanceTimersByTime(200);

    doc.visibilityState = "visible";
    docListeners["visibilitychange"]();

    jest.advanceTimersByTime(100);

    expect(orchestrator.ensureAllConnections).toHaveBeenCalledWith({
      force: false,
    });
  });

  it("coalesces rapid resume events (visibilitychange, pageshow, focus, online)", () => {
    setupAppLifecycle(win, doc, orchestrator, {
      debounceMs: 250,
      minSleepDurationMs: 1000,
    });

    doc.visibilityState = "hidden";
    docListeners["visibilitychange"]();
    jest.advanceTimersByTime(2000);

    // Device wakes up
    doc.visibilityState = "visible";
    docListeners["visibilitychange"]();

    // Chrome fires pageshow, focus, online right after
    jest.advanceTimersByTime(20);
    winListeners["pageshow"]?.({ persisted: true });

    jest.advanceTimersByTime(20);
    winListeners["focus"]?.();

    jest.advanceTimersByTime(20);
    winListeners["online"]?.();

    // Total 60ms elapsed, still within 250ms debounce
    expect(orchestrator.ensureAllConnections).not.toHaveBeenCalled();

    // Advance remaining debounce time
    jest.advanceTimersByTime(250);

    // Should only be called ONCE
    expect(orchestrator.ensureAllConnections).toHaveBeenCalledTimes(1);
    expect(orchestrator.ensureAllConnections).toHaveBeenCalledWith({
      force: true,
    });
  });

  it("cancels pending reconnect if app goes hidden again during debounce", () => {
    setupAppLifecycle(win, doc, orchestrator, { debounceMs: 250 });

    doc.visibilityState = "visible";
    docListeners["visibilitychange"]();

    // Debounce is pending
    expect(orchestrator.ensureAllConnections).not.toHaveBeenCalled();

    // User immediately switches away / phone locks before debounce expires
    doc.visibilityState = "hidden";
    docListeners["visibilitychange"]();

    // Advance past debounce
    jest.advanceTimersByTime(500);

    expect(orchestrator.ensureAllConnections).not.toHaveBeenCalled();
  });

  it("cleanup cancels any pending debounce timer", () => {
    const cleanup = setupAppLifecycle(win, doc, orchestrator, {
      debounceMs: 250,
    });

    winListeners["online"]();
    cleanup();

    jest.advanceTimersByTime(500);
    expect(orchestrator.ensureAllConnections).not.toHaveBeenCalled();
  });
});
