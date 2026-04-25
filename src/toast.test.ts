import {
  clearAllToasts,
  dismissToast,
  showError,
  showInfo,
  showSuccess,
  showToast,
  showWarning,
} from "./toast.js";
import { toastStore } from "./stores/toast.js";

describe("toast API", () => {
  beforeEach(() => {
    clearAllToasts();
  });

  test("showToast forwards options", () => {
    const id = showToast("hello", { type: "success", duration: 1234 });

    expect(id).toBeGreaterThan(0);

    expect(toastStore.toasts[0]).toMatchObject({
      message: "hello",
      type: "success",
      duration: 1234,
    });
  });

  test("helper variants set expected types", () => {
    showSuccess("ok", 1);
    showError("err", 2);
    showWarning("warn", 3);
    showInfo("info", 4);

    expect(toastStore.toasts.map((t) => t.type)).toEqual([
      "success",
      "error",
      "warning",
      "info",
    ]);
  });

  test("dismissToast and clearAllToasts remove toasts", () => {
    const id = showInfo("to dismiss", 0);
    dismissToast(id);

    expect(toastStore.toasts).toHaveLength(0);

    showInfo("one", 0);
    showInfo("two", 0);
    clearAllToasts();

    expect(toastStore.toasts).toHaveLength(0);
  });
});
