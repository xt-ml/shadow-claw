import { jest } from "@jest/globals";

let watcherInstance = null;

class MockWatcher {
  constructor(onChange) {
    this.onChange = onChange;
    this.pending = [];
    this.watch = jest.fn();
    this.unwatch = jest.fn();
    this.getPending = jest.fn(() => this.pending);
    watcherInstance = this;
  }

  trigger() {
    this.onChange();
  }
}

class MockComputed {
  constructor(fn) {
    this.fn = fn;
  }

  get() {
    return this.fn();
  }
}

jest.unstable_mockModule("signal-polyfill", () => ({
  Signal: {
    subtle: { Watcher: MockWatcher },
    Computed: MockComputed,
  },
}));

const { effect } = await import("./effect.mjs");

describe("effect", () => {
  let originalQueueMicrotask;

  beforeEach(() => {
    jest.clearAllMocks();
    watcherInstance.pending = [];
    originalQueueMicrotask = globalThis.queueMicrotask;
  });

  afterEach(() => {
    globalThis.queueMicrotask = originalQueueMicrotask;
  });

  it("runs callback immediately and disposes cleanly", () => {
    const callback = jest.fn();

    const dispose = effect(callback);

    expect(callback).toHaveBeenCalledTimes(1);

    expect(watcherInstance.watch).toHaveBeenCalled();

    dispose();

    expect(watcherInstance.unwatch).toHaveBeenCalled();
  });

  it("invokes cleanup on dispose", () => {
    const cleanup = jest.fn();

    const dispose = effect(() => cleanup);

    dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("processes pending signals and re-watches on watcher callback", () => {
    const pendingA = { get: jest.fn() };
    const pendingB = { get: jest.fn() };
    watcherInstance.pending = [pendingA, pendingB];

    globalThis.queueMicrotask = jest.fn((fn) => fn());

    effect(() => {});
    watcherInstance.watch.mockClear();

    watcherInstance.trigger();

    expect(globalThis.queueMicrotask).toHaveBeenCalledTimes(1);

    expect(pendingA.get).toHaveBeenCalledTimes(1);

    expect(pendingB.get).toHaveBeenCalledTimes(1);

    expect(watcherInstance.watch).toHaveBeenCalledTimes(1);
  });

  it("enqueues only once while pending processing is queued", () => {
    const queued = [];
    globalThis.queueMicrotask = jest.fn((fn) => {
      queued.push(fn);
    });

    effect(() => {});

    watcherInstance.trigger();
    watcherInstance.trigger();

    // needsEnqueue should prevent duplicate queueing before pending job runs
    expect(globalThis.queueMicrotask).toHaveBeenCalledTimes(1);

    queued[0]();

    watcherInstance.trigger();

    expect(globalThis.queueMicrotask).toHaveBeenCalledTimes(2);
  });
});
