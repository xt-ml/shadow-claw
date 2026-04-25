import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { toastStore } from "../../stores/toast.js";

jest.unstable_mockModule("../../effect.js", () => ({
  effect: jest.fn((fn: any) => {
    fn();

    return () => {};
  }),
}));

// Global fetch is already mocked in jest-setup.ts

const { ShadowClawToast } = await import("./shadow-claw-toast.js");

describe("shadow-claw-toast", () => {
  let el: any;

  beforeEach(async () => {
    toastStore.clear();
    el = new ShadowClawToast();
    document.body.appendChild(el);
    await el.onTemplateReady;
  });

  afterEach(() => {
    document.body.removeChild(el);
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-toast")).toBe(ShadowClawToast);
  });

  it("renders toasts from store", async () => {
    toastStore.show("Test toast", { type: "info" });
    await el.render();

    const container = el.shadowRoot?.querySelector(".toast-container");
    expect(container?.children.length).toBe(1);
    expect(container?.textContent).toContain("Test toast");
  });

  it("dismisses toast when close button clicked", async () => {
    toastStore.show("Dismiss me", { type: "info" });
    await el.render();

    const closeBtn = el.shadowRoot?.querySelector(".toast-close");
    expect(closeBtn).not.toBeNull();
    closeBtn?.dispatchEvent(new Event("click"));

    // Real wait for animation
    await new Promise((r) => setTimeout(r, 250));
    await Promise.resolve();

    expect(toastStore.toasts.length).toBe(0);
  });

  it("escapes HTML in toast messages", async () => {
    const message = "<script>alert('xss')</script>";
    toastStore.show(message, { type: "info" });
    await el.render();

    const toastMessage = el.shadowRoot?.querySelector(".toast-message");
    expect(toastMessage?.innerHTML).toContain("&lt;script&gt;");
  });

  it("executes action when action button clicked", async () => {
    const onClick: any = jest.fn();
    toastStore.show("Action toast", {
      type: "info",
      action: { label: "Click", onClick },
    });
    await el.render();

    const actionBtn = el.shadowRoot?.querySelector(".toast-action");
    expect(actionBtn).not.toBeNull();
    actionBtn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));
    expect(onClick).toHaveBeenCalled();
  });
});
