import { jest } from "@jest/globals";

import { ToastStore } from "../stores/toast.js";

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

  test("clear removes all toasts and timers", () => {
    const store = new ToastStore();
    store.show("toast 1");
    store.show("toast 2");
    expect(store.toasts).toHaveLength(2);

    store.clear();
    expect(store.toasts).toHaveLength(0);
  });

  test("caps visible toasts at MAX_VISIBLE_TOASTS", () => {
    const store = new ToastStore();
    for (let i = 1; i <= 7; i++) {
      store.show(`toast ${i}`);
    }

    expect(store.toasts).toHaveLength(5);
    expect(store.toasts[0].message).toBe("toast 3");
    expect(store.toasts[4].message).toBe("toast 7");
  });

  test("executes action via runAction", async () => {
    const store = new ToastStore();
    const actionSpy: any = jest.fn();
    const id = store.show("with action", {
      action: { label: "Retry", onClick: actionSpy },
    });

    await store.runAction(id);
    expect(actionSpy).toHaveBeenCalledTimes(1);

    // No-op for non-existent or action-less toast
    await store.runAction(999);
  });

  test("resolvers handle invalid inputs gracefully", () => {
    const store = new ToastStore();
    expect(store.resolveType("invalid" as any)).toBe("info");
    expect(store.resolveType("error")).toBe("error");

    expect(store.resolveDuration(-10)).toBe(4000);
    expect(store.resolveDuration(NaN)).toBe(4000);
    expect(store.resolveDuration(2500)).toBe(2500);

    expect(
      store.resolveAction({ label: "", onClick: "not-fn" } as any),
    ).toBeUndefined();
    expect(store.resolveAction(undefined)).toBeUndefined();
  });
});
