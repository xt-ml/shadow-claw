import { jest } from "@jest/globals";
import { toastStore } from "../../stores/toast.js";

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn((fn: any) => {
    fn();

    return () => {};
  }),
}));

const { ShadowClawToast } = await import("./shadow-claw-toast.js");

describe("shadow-claw-toast", () => {
  let el: any;

  beforeEach(async () => {
    toastStore.clear();
    el = new ShadowClawToast();
    document.body.appendChild(el);
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

  it("dismisses toast on Escape key press", async () => {
    toastStore.show("Dismiss on esc", { type: "info" });
    await el.render();

    const toastEl = el.shadowRoot?.querySelector(".toast");
    expect(toastEl).not.toBeNull();

    const escEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    toastEl?.dispatchEvent(escEvent);

    await new Promise((r) => setTimeout(r, 250));
    expect(toastStore.toasts.length).toBe(0);
  });

  it("ignores non-Escape keydown or invalid targets", async () => {
    toastStore.show("Stay open", { type: "info" });
    await el.render();

    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    el.shadowRoot?.dispatchEvent(enterEvent);

    // Event on non-toast element
    const escOnRoot = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: false,
    });
    el.shadowRoot?.dispatchEvent(escOnRoot);

    expect(toastStore.toasts.length).toBe(1);
  });

  it("pauses and resumes on mouseenter / mouseleave", async () => {
    const pauseSpy = jest.spyOn(toastStore, "pause");
    const resumeSpy = jest.spyOn(toastStore, "resume");

    const id = toastStore.show("Hover me", { type: "warning" });
    await el.render();

    const toastEl = el.shadowRoot?.querySelector(".toast");
    toastEl?.dispatchEvent(new MouseEvent("mouseenter"));
    expect(pauseSpy).toHaveBeenCalledWith(id);

    toastEl?.dispatchEvent(new MouseEvent("mouseleave"));
    expect(resumeSpy).toHaveBeenCalledWith(id);
  });

  it("renders appropriate icons for all toast types", () => {
    expect(el.iconForType("success")).toBe("✓");
    expect(el.iconForType("error")).toBe("!");
    expect(el.iconForType("warning")).toBe("⚠");
    expect(el.iconForType("info")).toBe("i");
  });

  it("delegates show() to toastStore.show", () => {
    const id = el.show("Via helper", { type: "success" });
    expect(id).toBeDefined();
    expect(toastStore.toasts.some((t) => t.message === "Via helper")).toBe(
      true,
    );
  });

  it("returns early if toast is already exiting", async () => {
    const id = toastStore.show("Exiting toast", { type: "info" });
    await el.render();

    el.exitingToasts.add(id);
    await el.dismissWithAnimation(id);
    // Should not re-add or throw
    expect(el.exitingToasts.has(id)).toBe(true);
  });
});
