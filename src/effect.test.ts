import { jest } from "@jest/globals";

let watcherInstance: any = null;

class MockWatcher {
  onChange: any;
  pending: any[];
  watch: any;
  unwatch: any;
  getPending: any;

  constructor(onChange: any) {
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
  fn: any;
  constructor(fn: any) {
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

const { effect } = await import("./effect.js");

describe("effect", () => {
  let originalQueueMicrotask: any;

  beforeEach(() => {
    jest.clearAllMocks();
    watcherInstance.pending = [];
    originalQueueMicrotask = globalThis.queueMicrotask;
  });

  afterEach(() => {
    globalThis.queueMicrotask = originalQueueMicrotask;
  });

  it("runs callback immediately and disposes cleanly", () => {
    const callback = jest.fn() as any;

    const dispose = effect(callback);

    expect(callback).toHaveBeenCalledTimes(1);

    expect(watcherInstance.watch).toHaveBeenCalled();

    dispose();

    expect(watcherInstance.unwatch).toHaveBeenCalled();
  });

  it("invokes cleanup on dispose", () => {
    const cleanup = jest.fn();

    const dispose = effect(() => cleanup as any);

    dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("processes pending signals and re-watches on watcher callback", () => {
    const pendingA: any = { get: jest.fn() };
    const pendingB: any = { get: jest.fn() };
    watcherInstance.pending = [pendingA, pendingB];

    (globalThis as any).queueMicrotask = jest.fn((fn: any) => fn());

    effect(() => {});
    watcherInstance.watch.mockClear();

    watcherInstance.trigger();

    expect((globalThis as any).queueMicrotask).toHaveBeenCalledTimes(1);

    expect(pendingA.get).toHaveBeenCalledTimes(1);

    expect(pendingB.get).toHaveBeenCalledTimes(1);

    expect(watcherInstance.watch).toHaveBeenCalledTimes(1);
  });

  it("enqueues only once while pending processing is queued", () => {
    const queued: any[] = [];
    (globalThis as any).queueMicrotask = jest.fn((fn: any) => {
      queued.push(fn);
    });

    effect(() => {});

    watcherInstance.trigger();
    watcherInstance.trigger();

    // needsEnqueue should prevent duplicate queueing before pending job runs
    expect((globalThis as any).queueMicrotask).toHaveBeenCalledTimes(1);

    queued[0]();

    watcherInstance.trigger();

    expect((globalThis as any).queueMicrotask).toHaveBeenCalledTimes(2);
  });
});
