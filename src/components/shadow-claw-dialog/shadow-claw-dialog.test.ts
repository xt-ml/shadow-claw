import { jest } from "@jest/globals";
import { ShadowClawDialog } from "./shadow-claw-dialog.js";

describe("shadow-claw-dialog", () => {
  it("wraps its light DOM children in a native dialog", () => {
    const el = new ShadowClawDialog();
    el.setAttribute("dialog-class", "test-dialog");
    el.setAttribute("dialog-aria-label", "Example dialog");
    el.innerHTML = '<div class="content">Hello</div>';

    document.body.appendChild(el);

    const dialog = el.querySelector("dialog.test-dialog");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog?.getAttribute("aria-label")).toBe("Example dialog");
    expect(dialog?.querySelector(".content")?.textContent).toBe("Hello");

    document.body.removeChild(el);
  });

  it("clones nested template content into the native dialog", () => {
    const el = new ShadowClawDialog();
    el.setAttribute("dialog-class", "template-dialog");
    el.innerHTML =
      '<template><div class="content">From template</div></template>';

    document.body.appendChild(el);

    const dialog = el.querySelector("dialog.template-dialog");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog?.querySelector(".content")?.textContent).toBe(
      "From template",
    );

    document.body.removeChild(el);
  });

  it("exposes observedAttributes and updates attributes dynamically", () => {
    expect(ShadowClawDialog.observedAttributes).toEqual([
      "dialog-class",
      "dialog-aria-label",
      "dialog-aria-labelledby",
    ]);

    const el = new ShadowClawDialog();
    document.body.appendChild(el);

    el.setAttribute("dialog-class", "custom-class");
    el.setAttribute("dialog-aria-label", "Dynamic Label");
    el.setAttribute("dialog-aria-labelledby", "heading-id");

    const dialog = el.dialog!;
    expect(dialog.className).toBe("custom-class");
    expect(dialog.getAttribute("aria-label")).toBe("Dynamic Label");
    expect(dialog.getAttribute("aria-labelledby")).toBe("heading-id");

    // Remove aria attributes
    el.removeAttribute("dialog-aria-label");
    el.removeAttribute("dialog-aria-labelledby");
    expect(dialog.hasAttribute("aria-label")).toBe(false);
    expect(dialog.hasAttribute("aria-labelledby")).toBe(false);

    document.body.removeChild(el);
  });

  it("supports showModal, open, close, and returnValue", () => {
    const el = new ShadowClawDialog();
    document.body.appendChild(el);

    const dialog = el.dialog!;
    dialog.showModal = jest.fn(() => {
      dialog.setAttribute("open", "");
    });
    dialog.close = jest.fn((ret?: string) => {
      dialog.removeAttribute("open");
      if (ret !== undefined) dialog.returnValue = ret;
    });

    expect(el.open).toBe(false);
    el.showModal();
    expect(dialog.showModal).toHaveBeenCalled();
    expect(el.open).toBe(true);

    el.returnValue = "confirmed";
    expect(el.returnValue).toBe("confirmed");

    el.close("cancel");
    expect(dialog.close).toHaveBeenCalledWith("cancel");
    expect(el.returnValue).toBe("cancel");
    expect(el.open).toBe(false);

    document.body.removeChild(el);
  });

  it("handles fallback showModal and close when native methods are absent", () => {
    const el = new ShadowClawDialog();
    document.body.appendChild(el);

    const dialog = el.dialog!;
    (dialog as any).showModal = undefined;
    (dialog as any).close = undefined;

    el.showModal();
    expect(dialog.hasAttribute("open")).toBe(true);

    el.close("closed-val");
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(dialog.returnValue).toBe("closed-val");

    // Close again without returnValue argument
    el.showModal();
    expect(dialog.hasAttribute("open")).toBe(true);
    el.close();
    expect(dialog.hasAttribute("open")).toBe(false);

    document.body.removeChild(el);
  });

  it("handles attributeChangedCallback safely before dialog is attached", () => {
    const el = new ShadowClawDialog();
    // Prior to connectedCallback/ensureDialog, this._dialog is null
    expect(() => el.attributeChangedCallback()).not.toThrow();
    expect(el.open).toBe(false);
    expect(el.returnValue).toBe("");
    expect(() => {
      el.returnValue = "initial";
    }).not.toThrow();
  });

  it("ensures dialog is idempotent when called repeatedly", () => {
    const el = new ShadowClawDialog();
    document.body.appendChild(el);

    const firstDialog = el.dialog;
    el.ensureDialog();
    expect(el.dialog).toBe(firstDialog);

    document.body.removeChild(el);
  });
});
