import "./shadow-claw-toast.mjs";
import { jest } from "@jest/globals";
import { toastStore } from "../stores/toast.mjs";

describe("shadow-claw-toast", () => {
  beforeEach(() => {
    toastStore.clear();
    document.body.innerHTML = "";
  });

  test("renders toast messages from store", async () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Rendered toast", { type: "success", duration: 0 });
    el.renderToasts();

    const message = el.shadowRoot?.querySelector(".toast-message");
    expect(message?.textContent).toBe("Rendered toast");
  });

  test("close button dismisses toast", async () => {
    jest.useFakeTimers();
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Dismiss toast", { type: "info", duration: 0 });
    el.renderToasts();

    const close = el.shadowRoot?.querySelector(".toast-close");
    close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    jest.advanceTimersByTime(160);
    await Promise.resolve();

    expect(toastStore.toasts).toHaveLength(0);
    jest.useRealTimers();
  });
});
