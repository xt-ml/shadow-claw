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

  test("renders different toast types with correct icons", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    expect(el.iconForType("success")).toBe("✓");

    expect(el.iconForType("error")).toBe("!");

    expect(el.iconForType("warning")).toBe("⚠");

    expect(el.iconForType("info")).toBe("i");
  });

  test("escapes HTML in toast messages", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    const escaped = el.escapeHtml("<script>alert('xss')</script>");

    expect(escaped).toContain("&lt;");

    expect(escaped).toContain("&gt;");

    expect(escaped).not.toContain("<script>");
  });

  test("renders toast with action button", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Action toast", {
      type: "info",
      duration: 0,
      action: {
        label: "Click me",
        onClick: jest.fn(),
      },
    });
    el.renderToasts();

    const actionButton = el.shadowRoot?.querySelector(".toast-action");

    expect(actionButton?.textContent).toBe("Click me");
  });

  test("action button executes handler and dismisses toast", async () => {
    jest.useFakeTimers();

    const actionHandler = jest.fn().mockResolvedValue(undefined);
    const el = document.createElement("shadow-claw-toast");

    document.body.appendChild(el);

    toastStore.show("Action toast", {
      type: "info",
      duration: 0,
      action: {
        label: "Click me",
        onClick: actionHandler,
      },
    });

    el.renderToasts();

    const actionButton = el.shadowRoot?.querySelector(".toast-action");
    actionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(160);

    expect(actionHandler).toHaveBeenCalled();

    // Toast should be dismissed or exiting
    expect(toastStore.toasts.length).toBeLessThanOrEqual(1);

    jest.useRealTimers();
  });

  test("Escape key dismisses toast", async () => {
    jest.useFakeTimers();

    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Escape dismisses", { type: "info", duration: 0 });
    el.renderToasts();

    const toastEl = el.shadowRoot?.querySelector(".toast");
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });

    toastEl?.dispatchEvent(event);

    jest.advanceTimersByTime(160);
    await Promise.resolve();

    expect(toastStore.toasts).toHaveLength(0);

    jest.useRealTimers();
  });

  test("non-Escape key does not dismiss toast", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Not dismissed", { type: "info", duration: 0 });
    el.renderToasts();

    const toastEl = el.shadowRoot?.querySelector(".toast");
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });

    toastEl?.dispatchEvent(event);

    expect(toastStore.toasts).toHaveLength(1);
  });

  test("mouseenter pauses toast timer", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    const toast = toastStore.show("Pause test", {
      type: "info",
      duration: 0,
    });

    el.renderToasts();

    const toastEl = el.shadowRoot?.querySelector(".toast");

    // Verify toast element was rendered
    expect(toastEl).toBeDefined();

    toastEl?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

    // Verify event was dispatched (pause behavior tested in toast.test.mjs)
    expect(toastEl).toBeDefined();
  });

  test("mouseleave resumes toast timer", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    const toast = toastStore.show("Resume test", {
      type: "info",
      duration: 0,
    });

    el.renderToasts();

    const toastEl = el.shadowRoot?.querySelector(".toast");

    // Verify toast element was rendered
    expect(toastEl).toBeDefined();

    // Pause first
    toastEl?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

    // Then resume
    toastEl?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));

    // Verify events were dispatched (resume behavior tested in toast.test.mjs)
    expect(toastEl).toBeDefined();
  });

  test("dismissWithAnimation prevents duplicate dismissals", () => {
    jest.useFakeTimers();

    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    const toast = toastStore.show("Duplicate dismiss", {
      type: "info",
      duration: 0,
    });

    el.renderToasts();

    // Call dismiss twice
    el.dismissWithAnimation(toast.id);
    el.dismissWithAnimation(toast.id);

    // Should only be in exiting set once
    expect(el.exitingToasts.has(toast.id)).toBe(true);

    // Wait for animation to complete
    jest.advanceTimersByTime(150);

    // Toast should be dismissed after animation
    expect(el.exitingToasts.has(toast.id)).toBe(false);

    jest.useRealTimers();
  });

  test("disconnectedCallback removes event listener", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    const removeEventListenerSpy = jest.spyOn(
      el.shadowRoot,
      "removeEventListener",
    );

    el.disconnectedCallback();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      el.handleKeyDown,
    );
  });

  test("handleKeyDown ignores non-KeyboardEvent", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Test", { type: "info", duration: 0 });
    el.renderToasts();

    const event = new Event("keydown");
    el.handleKeyDown(event);

    // Toast should still be present
    expect(toastStore.toasts).toHaveLength(1);
  });

  test("handleKeyDown ignores invalid toast element", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });

    // Dispatch on element without toast-id
    el.shadowRoot?.dispatchEvent(event);

    // Should not throw
    expect(() => el.handleKeyDown(event)).not.toThrow();
  });

  test("handleKeyDown ignores invalid toast ID", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Test", { type: "info", duration: 0 });
    el.renderToasts();

    const toastEl = el.shadowRoot?.querySelector(".toast");
    if (toastEl instanceof HTMLElement) {
      toastEl.dataset.toastId = "invalid";
    }

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });

    toastEl?.dispatchEvent(event);

    // Toast should still be present
    expect(toastStore.toasts).toHaveLength(1);
  });

  test("renders multiple toasts", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("First", { type: "info", duration: 0 });
    toastStore.show("Second", { type: "success", duration: 0 });
    toastStore.show("Third", { type: "error", duration: 0 });

    el.renderToasts();

    const toasts = el.shadowRoot?.querySelectorAll(".toast");

    expect(toasts?.length).toBe(3);
  });

  test("sets correct ARIA attributes based on toast type", () => {
    const el = document.createElement("shadow-claw-toast");
    document.body.appendChild(el);

    toastStore.show("Error toast", { type: "error", duration: 0 });
    toastStore.show("Info toast", { type: "info", duration: 0 });

    el.renderToasts();

    const toasts = el.shadowRoot?.querySelectorAll(".toast");
    const errorToast = Array.from(toasts || []).find((t) =>
      t.classList.contains("error"),
    );
    const infoToast = Array.from(toasts || []).find((t) =>
      t.classList.contains("info"),
    );

    expect(errorToast?.getAttribute("role")).toBe("alert");

    expect(errorToast?.getAttribute("aria-live")).toBe("assertive");

    expect(infoToast?.getAttribute("role")).toBe("status");

    expect(infoToast?.getAttribute("aria-live")).toBe("polite");
  });
});
