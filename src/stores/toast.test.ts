import { jest } from "@jest/globals";

import { ToastStore } from "./toast.js";

describe("ToastStore", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("show creates a toast with defaults", () => {
    const store = new ToastStore();
    const id = store.show("hello");

    expect(id).toBe(1);

    expect(store.toasts).toHaveLength(1);

    expect(store.toasts[0]).toMatchObject({
      id: 1,
      message: "hello",
      type: "info",
      duration: 4000,
    });
  });

  test("dismiss removes the toast", () => {
    const store = new ToastStore();
    const id = store.show("dismiss me", { duration: 0 });
    store.dismiss(id);

    expect(store.toasts).toHaveLength(0);
  });

  test("auto dismiss removes toast after duration", () => {
    const store = new ToastStore();
    store.show("auto", { duration: 1000 });

    expect(store.toasts).toHaveLength(1);

    jest.advanceTimersByTime(1000);

    expect(store.toasts).toHaveLength(0);
  });

  test("pause and resume preserves remaining time", () => {
    const store = new ToastStore();
    store.show("pause", { duration: 1000 });

    jest.advanceTimersByTime(400);
    store.pause(1);

    jest.advanceTimersByTime(1000);

    expect(store.toasts).toHaveLength(1);

    store.resume(1);
    jest.advanceTimersByTime(599);

    expect(store.toasts).toHaveLength(1);

    jest.advanceTimersByTime(1);

    expect(store.toasts).toHaveLength(0);
  });
});
